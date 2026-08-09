import { readFileSync } from "node:fs";

const DEFAULT_BASE_URL = "https://127.0.0.1:27124";

export interface SearchMatch {
  filename: string;
  score: number;
  matches: Array<{ context: string }>;
}

export function resolveApiKey(pluginDataPath: string): string {
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
  private readonly skipTls: boolean;

  constructor(apiKey: string, baseUrl: string = DEFAULT_BASE_URL) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("ObsidianRestClient requires an API key");
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.skipTls =
      this.baseUrl.startsWith("https://127.0.0.1") ||
      this.baseUrl.startsWith("https://localhost");
  }

  private async request(
    path: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (this.skipTls) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...init.headers,
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "<no body>");
        throw new Error(
          `Obsidian REST API: ${init.method ?? "GET"} ${path} -> ${res.status} ${res.statusText}\n${body}`
        );
      }

      return res;
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.startsWith("Obsidian REST API:")
      ) {
        throw err;
      }
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to reach Obsidian Local REST API at ${url}: ${reason}. Is Obsidian running?`
      );
    } finally {
      if (this.skipTls) {
        if (prev === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev;
      }
    }
  }

  private validatePath(notePath: string): void {
    if (notePath.includes("..") || notePath.startsWith("/")) {
      throw new Error(
        `Invalid vault path: "${notePath}". Path must be relative and cannot contain "..".`
      );
    }
  }

  private async parseJson<T>(res: Response): Promise<T> {
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Expected JSON response but got: ${text.slice(0, 200)}`);
    }
  }

  private encodePath(path: string): string {
    return path
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
  }

  async readNote(path: string): Promise<string> {
    this.validatePath(path);
    const res = await this.request(`/vault/${this.encodePath(path)}`, {
      method: "GET",
      headers: { Accept: "text/markdown" },
    });
    return res.text();
  }

  async writeNote(path: string, content: string): Promise<void> {
    this.validatePath(path);
    await this.request(`/vault/${this.encodePath(path)}`, {
      method: "PUT",
      headers: { "Content-Type": "text/markdown" },
      body: content,
    });
  }

  async appendNote(path: string, content: string): Promise<void> {
    this.validatePath(path);
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
    this.validatePath(path);
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
    this.validatePath(path);
    await this.request(`/vault/${this.encodePath(path)}`, {
      method: "DELETE",
    });
  }

  async listFiles(folder?: string): Promise<string[]> {
    if (folder) this.validatePath(folder);
    const suffix = folder ? `${this.encodePath(folder)}/` : "";
    const res = await this.request(`/vault/${suffix}`, { method: "GET" });
    const data = await this.parseJson<{ files: string[] }>(res);
    return data.files ?? [];
  }

  async search(query: string): Promise<SearchMatch[]> {
    const res = await this.request(
      `/search/simple/?query=${encodeURIComponent(query)}`,
      { method: "POST" }
    );
    return this.parseJson<SearchMatch[]>(res);
  }

  async getTags(): Promise<Array<{ name: string; count: number }>> {
    const res = await this.request("/tags/", { method: "GET" });
    const data = await this.parseJson<{ tags: Array<{ name: string; count: number }> }>(res);
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
