# pi-obsidian-rest

Pi extension that gives AI agents safe access to your Obsidian vault through the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin. No CLI IPC, no fragmentation crashes.

## Disclaimer

Created for personal use; published for posterity, sharing, and people who need similar functionality. Caveat emptor: provided as-is, with no guarantees or warranties. I am not responsible for issues arising from anyone else's use.

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

## Configuration

All configuration is via environment variables. None are required if Obsidian is running with the Local REST API plugin on the same machine.

| Variable | Description |
|----------|-------------|
| `OBSIDIAN_VAULT_PATH` | Explicit vault path. Skips auto-detection. |
| `OBSIDIAN_REST_API_KEY` | REST API key. Skips reading from plugin config. |
| `OBSIDIAN_PLUGIN_DATA_PATH` | Path to the plugin's `data.json`. Skips vault-based resolution. |

### Auto-detection

If no environment variables are set, the extension:

1. Reads Obsidian's `obsidian.json` to find the currently open vault
   - **Windows:** `%APPDATA%\obsidian\obsidian.json`
   - **macOS:** `~/Library/Application Support/obsidian/obsidian.json`
   - **Linux:** `$XDG_CONFIG_HOME/obsidian/obsidian.json` (defaults to `~/.config`)
2. Locates the REST API plugin's `data.json` inside the vault's `.obsidian/plugins/` directory
3. Reads the API key from that file

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

## Security

- **Path traversal protection:** All note paths are validated — `..` segments and absolute paths are rejected before any API call is made.
- **Scoped TLS override:** The REST API plugin uses a self-signed certificate on localhost. TLS verification is disabled only during individual requests to `127.0.0.1`/`localhost` and restored immediately after.
- **Vault guard:** Pi's built-in `read`, `write`, `edit`, `ls`, `find`, `grep`, and `bash` tools are blocked when they target the vault directory. The agent is redirected to use the `obsidian` tool instead.

## License

MIT
