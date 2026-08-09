import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";

import { ObsidianRestClient, resolveApiKey } from "./lib/rest-client.js";

const BLOCKED_TOOLS = new Set(["read", "write", "edit", "ls", "find", "grep", "bash"]);

function detectVaultPath(): string {
  const envPath = process.env.OBSIDIAN_VAULT_PATH;
  if (envPath) return envPath;

  let configDir: string;
  const platform = process.platform;
  if (platform === "win32") {
    configDir = path.join(
      process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
      "obsidian"
    );
  } else if (platform === "darwin") {
    configDir = path.join(os.homedir(), "Library", "Application Support", "obsidian");
  } else {
    configDir = path.join(
      process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"),
      "obsidian"
    );
  }

  try {
    const raw = readFileSync(path.join(configDir, "obsidian.json"), "utf-8");
    const data = JSON.parse(raw) as {
      vaults?: Record<string, { path: string; open?: boolean }>;
    };
    const vaults = Object.values(data.vaults ?? {});
    const open = vaults.find((v) => v.open) ?? vaults[0];
    if (open?.path) return open.path;
  } catch {
    // detection failed
  }

  throw new Error(
    "Could not detect Obsidian vault path. Set OBSIDIAN_VAULT_PATH environment variable."
  );
}

function resolvePluginDataPath(): string {
  if (process.env.OBSIDIAN_PLUGIN_DATA_PATH) return process.env.OBSIDIAN_PLUGIN_DATA_PATH;
  const vaultPath = detectVaultPath();
  return path.join(vaultPath, ".obsidian", "plugins", "obsidian-local-rest-api", "data.json");
}

function normalizeForCompare(p: string): string {
  return path.resolve(p).replace(/\\/g, "/").toLowerCase();
}

function targetsVault(candidatePath: string | undefined, vaultRoot: string): boolean {
  if (!candidatePath) return false;
  const normalizedVault = normalizeForCompare(vaultRoot);
  const normalizedCandidate = normalizeForCompare(candidatePath);
  return normalizedCandidate.startsWith(normalizedVault);
}

function extractPathFromInput(input: Record<string, unknown>): string | undefined {
  const candidates = ["path", "file_path", "filePath", "target", "directory", "cwd"];
  for (const key of candidates) {
    const value = input[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

interface ParsedCommand {
  op: string;
  arg: string;
}

function parseRun(run: string): ParsedCommand {
  const trimmed = run.trim();
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) {
    return { op: trimmed, arg: "" };
  }
  return {
    op: trimmed.slice(0, spaceIdx),
    arg: trimmed.slice(spaceIdx + 1).trim(),
  };
}

function formatSearchResults(
  results: Array<{ filename: string; score: number; matches: Array<{ context: string }> }>
): string {
  if (results.length === 0) return "No matches found.";
  return results
    .map((r) => {
      const context = r.matches.map((m) => `    ${m.context.trim()}`).join("\n");
      return `${r.filename} (score: ${r.score.toFixed(2)})\n${context}`;
    })
    .join("\n\n");
}

export default function (pi: ExtensionAPI) {
  const vaultRoot = detectVaultPath();

  let client: ObsidianRestClient | null = null;
  function getClient(): ObsidianRestClient {
    if (!client) {
      const dataPath = resolvePluginDataPath();
      const apiKey = resolveApiKey(dataPath);
      client = new ObsidianRestClient(apiKey);
    }
    return client;
  }

  pi.registerTool({
    name: "obsidian",
    label: "Obsidian",
    description:
      "Read, write, search, and manage notes in your Obsidian vault via the Local REST API plugin (no CLI IPC). " +
      "Commands: 'read <path>', 'write <path>' (+content), 'edit <path>' (+content, alias for write), " +
      "'append <path>' (+content), 'prepend <path>' (+content), " +
      "'search <query>', 'list [folder]', 'delete <path>', 'tags', 'status'.",
    parameters: Type.Object({
      run: Type.String({
        description:
          "Command string, e.g. 'read notes/foo.md', 'search project x', 'list', 'tags', 'status'.",
      }),
      content: Type.Optional(
        Type.String({
          description: "Content body for write/edit/append/prepend commands.",
        })
      ),
      vault: Type.Optional(
        Type.String({ description: "Reserved for future multi-vault support." })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { run, content } = params as { run: string; content?: string };
      const { op, arg } = parseRun(run);
      const c = getClient();

      try {
        switch (op) {
          case "read": {
            if (!arg) throw new Error("Usage: read <path>");
            const text = await c.readNote(arg);
            return { content: [{ type: "text", text }], details: {} };
          }
          case "write": {
            if (!arg) throw new Error("Usage: write <path> (with content param)");
            if (content === undefined) throw new Error("write requires a 'content' param");
            await c.writeNote(arg, content);
            return {
              content: [{ type: "text", text: `Wrote ${arg}` }],
              details: {},
            };
          }
          case "append": {
            if (!arg) throw new Error("Usage: append <path> (with content param)");
            if (content === undefined) throw new Error("append requires a 'content' param");
            await c.appendNote(arg, content);
            return {
              content: [{ type: "text", text: `Appended to ${arg}` }],
              details: {},
            };
          }
          case "prepend": {
            if (!arg) throw new Error("Usage: prepend <path> (with content param)");
            if (content === undefined) throw new Error("prepend requires a 'content' param");
            await c.patchNote(arg, content, "prepend");
            return {
              content: [{ type: "text", text: `Prepended to ${arg}` }],
              details: {},
            };
          }
          case "search": {
            if (!arg) throw new Error("Usage: search <query>");
            const results = await c.search(arg);
            return {
              content: [{ type: "text", text: formatSearchResults(results) }],
              details: {},
            };
          }
          case "list": {
            const files = await c.listFiles(arg || undefined);
            return {
              content: [{ type: "text", text: files.join("\n") || "(empty)" }],
              details: {},
            };
          }
          case "delete": {
            if (!arg) throw new Error("Usage: delete <path>");
            await c.deleteNote(arg);
            return {
              content: [{ type: "text", text: `Deleted ${arg}` }],
              details: {},
            };
          }
          case "tags": {
            const tags = await c.getTags();
            const lines = tags
              .sort((a, b) => b.count - a.count)
              .map((t) => `${t.name} (${t.count})`);
            return {
              content: [{ type: "text", text: lines.join("\n") || "(no tags)" }],
              details: {},
            };
          }
          case "status": {
            const ok = await c.status();
            return {
              content: [
                {
                  type: "text",
                  text: ok
                    ? "Obsidian Local REST API is reachable."
                    : "Obsidian Local REST API is NOT reachable.",
                },
              ],
              details: {},
            };
          }
          case "edit": {
            if (!arg) throw new Error("Usage: edit <path> (with content param)");
            if (content === undefined) throw new Error("edit requires a 'content' param");
            await c.writeNote(arg, content);
            return {
              content: [{ type: "text", text: `Edited ${arg}` }],
              details: {},
            };
          }
          default:
            throw new Error(
              `Unknown obsidian command "${op}". Supported: read, write, edit, append, prepend, search, list, delete, tags, status.`
            );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          details: { error: true },
        };
      }
    },
  });

  pi.on("tool_call", (event, _ctx) => {
    if (!BLOCKED_TOOLS.has(event.toolName)) return undefined;

    const input = (event.input ?? {}) as Record<string, unknown>;

    if (event.toolName === "bash" && typeof input.command === "string") {
      const cmd = input.command;
      const normalizedVault = normalizeForCompare(vaultRoot);
      if (cmd.replace(/\\/g, "/").toLowerCase().includes(normalizedVault) ||
          cmd.includes(".obsidian")) {
        return {
          block: true,
          reason:
            `Bash command targets the Obsidian vault (${vaultRoot}). ` +
            `Use the "obsidian" tool instead.`,
        };
      }
      return undefined;
    }

    const candidatePath = extractPathFromInput(input);
    if (!candidatePath) return undefined;

    if (targetsVault(candidatePath, vaultRoot)) {
      return {
        block: true,
        reason:
          `Direct "${event.toolName}" access to the Obsidian vault (${vaultRoot}) is blocked. ` +
          `Use the "obsidian" tool instead (e.g. run: "read <path>", "write <path>", "search <query>").`,
      };
    }

    return undefined;
  });
}
