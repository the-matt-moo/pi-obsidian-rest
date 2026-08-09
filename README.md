# pi-obsidian-rest

Pi extension that gives AI agents safe access to your Obsidian vault through the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin. No CLI IPC, no fragmentation crashes.

## Why

Pi agents with filesystem tools (`read`, `write`, `bash`) can accidentally corrupt Obsidian vaults — lock files, partial writes, encoding issues. This extension replaces direct filesystem access with HTTP calls to Obsidian's own REST API, which handles concurrency and indexing correctly.

It also installs a **vault guard** that intercepts Pi's built-in file tools and blocks any call targeting the vault path, redirecting the agent to use the `obsidian` tool instead.

## Prerequisites

1. [Obsidian](https://obsidian.md) with the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) community plugin installed and enabled
2. [Pi coding agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) installed

## Install

```bash
npm install pi-obsidian-rest
```

Add to your Pi agent settings (`~/.pi/agent/settings.json`):

```json
{
  "extensions": [
    "npm:pi-obsidian-rest"
  ]
}
```

## API Key Resolution

The extension resolves the REST API key in order:

1. `OBSIDIAN_REST_API_KEY` environment variable
2. Reading `apiKey` from the plugin's `data.json` config file

## Commands

All commands go through a single `obsidian` tool with a `run` parameter:

| Command | Description | Requires `content` param |
|---------|-------------|--------------------------|
| `read <path>` | Read a note as markdown | No |
| `write <path>` | Create or overwrite a note | Yes |
| `edit <path>` | Alias for `write` | Yes |
| `append <path>` | Append content to a note | Yes |
| `prepend <path>` | Prepend content to a note | Yes |
| `search <query>` | Full-text search across vault | No |
| `list [folder]` | List files in vault or folder | No |
| `delete <path>` | Delete a note | No |
| `tags` | List all tags with counts | No |
| `status` | Check if REST API is reachable | No |

### Examples

```
obsidian run:"read projects/todo.md"
obsidian run:"write journal/2024-01-15.md" content:"# Monday\nStarted new project."
obsidian run:"search meeting notes"
obsidian run:"list projects/"
obsidian run:"tags"
obsidian run:"status"
```

## Vault Guard

The extension registers a `tool_call` listener that blocks Pi's built-in tools (`read`, `write`, `edit`, `ls`, `find`, `grep`, `bash`) when they target the Obsidian vault path. Blocked calls return a message directing the agent to use the `obsidian` tool instead.

Vault path is auto-detected from Obsidian's `obsidian.json` config (the currently open vault), with a configurable fallback.

## License

MIT
