// Thin HTTP client for the obsidian-local-rest-api Obsidian plugin.
// Uses native fetch() only — no axios, no node-fetch.

import { readFileSync } from "node:fs";

const DEFAULT_BASE_URL = "https://127.0.0.1:27124";
const DEFAULT_PLUGIN_DATA_PATH =
  "E:\\AI\\Obsidian\\Moo\\.obsidian\\plugins\\obsidian-local-rest-api\\data.json";

export interface SearchMatch {
  filename: string;
  score: number;
  matches: Array<{ context: string }>;
}

/**
 * Locate the plugin's API key. Checks OBSIDIAN_REST_API_KEY first, then
 * falls back to reading data.json from the plugin's config directory.
 */
export function resolveApiKey(pluginDataPath = DEFAULT_PLUGIN_DATA_PATH): string {
  const envKey = process.env.OBSIDIAN_REST_API_KEY;
  if (envKey && envKey.trim().length > 0) {
    return envKey.trim();
  }

  try {
    const raw = readFileSync(pluginDataPath, "utf-8");
    const data = JSON.parse(raw) as { apiKey?: string };
    if (data.apiKey && data.apiKey.trim().length > 0) {
      return data.apiKey.trim();
    }
    throw new Error(`No "apiKey" field found in ${pluginDataPath}`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not resolve Obsidian REST API key: set OBSIDIAN_REST_API_KEY, or ensure ${pluginDataPath} exists with an apiKey field. (${reason})`
    );
  }
}

export class ObsidianRestClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, baseUrl: string = DEFAULT_BASE_URL) {
    if (!apiKey) {
      throw new Error("ObsidianRestClient requires an API key");
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    // Self-signed cert from obsidian-local-rest-api plugin
    if (this.baseUrl.startsWith("https://127.0.0.1") || this.baseUrl.startsWith("https://localhost")) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
  }

  private async request(
    path: string,
    init: RequestInit & { expectJson?: boolean } = {}
  ): Promise<Response> {
    const { expectJson: _expectJson, ...requestInit } = init;
    const url = `${this.baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        ...requestInit,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...requestInit.headers,
        },
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to reach Obsidian Local REST API at ${url}: ${reason}. Is Obsidian running with the obsidian-local-rest-api plugin enabled?`
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "<no body>");
      throw new Error(
        `Obsidian REST API request failed: ${requestInit.method ?? "GET"} ${path} -> ${res.status} ${res.statusText}\n${body}`
      );
    }

    return res;
  }

  private encodePath(path: string): string {
    return path
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
  }

  async readNote(path: string): Promise<string> {
    const res = await this.request(`/vault/${this.encodePath(path)}`, {
      method: "GET",
      headers: { Accept: "text/markdown" },
    });
    return res.text();
  }

  async writeNote(path: string, content: string): Promise<void> {
    await this.request(`/vault/${this.encodePath(path)}`, {
      method: "PUT",
      headers: { "Content-Type": "text/markdown" },
      body: content,
    });
  }

  async appendNote(path: string, content: string): Promise<void> {
    await this.request(`/vault/${this.encodePath(path)}`, {
      method: "POST",
      headers: { "Content-Type": "text/markdown" },
      body: content,
    });
  }

  async patchNote(
    path: string,
    content: string,
    operation: "prepend" | "append" | "replace"
  ): Promise<void> {
    await this.request(`/vault/${this.encodePath(path)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "text/markdown",
        Operation: operation,
        "Target-Type": "file",
      },
      body: content,
    });
  }

  async deleteNote(path: string): Promise<void> {
    await this.request(`/vault/${this.encodePath(path)}`, {
      method: "DELETE",
    });
  }

  async listFiles(folder?: string): Promise<string[]> {
    const suffix = folder ? `${this.encodePath(folder)}/` : "";
    const res = await this.request(`/vault/${suffix}`, { method: "GET" });
    const data = (await res.json()) as { files: string[] };
    return data.files ?? [];
  }

  async search(query: string): Promise<SearchMatch[]> {
    const res = await this.request(
      `/search/simple/?query=${encodeURIComponent(query)}`,
      { method: "POST" }
    );
    return (await res.json()) as SearchMatch[];
  }

  async getTags(): Promise<Array<{ name: string; count: number }>> {
    const res = await this.request("/tags/", { method: "GET" });
    const data = (await res.json()) as { tags: Array<{ name: string; count: number }> };
    return data.tags ?? [];
  }

  async status(): Promise<boolean> {
    try {
      await this.request("/", { method: "GET" });
      return true;
    } catch {
      return false;
    }
  }
}
