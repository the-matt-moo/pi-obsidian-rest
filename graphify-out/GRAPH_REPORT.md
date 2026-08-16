# Graph Report - pi-obsidian-rest  (2026-08-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 66 nodes · 93 edges · 6 communities (4 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `83e1f608`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5

## God Nodes (most connected - your core abstractions)
1. `ObsidianRestClient` - 16 edges
2. `compilerOptions` - 8 edges
3. `keywords` - 8 edges
4. `execute()` - 4 edges
5. `getClient()` - 4 edges
6. `resolvePluginDataPath()` - 3 edges
7. `resolveApiKey()` - 3 edges
8. `repository` - 3 edges
9. `detectVaultPath()` - 2 edges
10. `formatSearchResults()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `getClient()` --calls--> `resolveApiKey()`  [EXTRACTED]
  extensions/index.ts → extensions/lib/rest-client.ts

## Import Cycles
- None detected.

## Communities (6 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (14): @earendil-works/pi-coding-agent, description, extensions, license, name, peerDependencies, @earendil-works/pi-coding-agent, @sinclair/typebox (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.21
Nodes (12): BLOCKED_TOOLS, detectVaultPath(), execute(), formatSearchResults(), getClient(), normalizeForCompare(), ParsedCommand, parseRun() (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (10): extensions/**/*.ts, compilerOptions, esModuleInterop, module, moduleResolution, outDir, skipLibCheck, strict (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.25
Nodes (8): keywords, ai-agent, notes, obsidian, obsidian-api, pi-extension, pi-package, vault

## Knowledge Gaps
- **29 isolated node(s):** `ParsedCommand`, `SearchMatch`, `description`, `extensions`, `license` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ObsidianRestClient` connect `Community 2` to `Community 1`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Why does `keywords` connect `Community 4` to `Community 0`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `ParsedCommand`, `SearchMatch`, `description` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._