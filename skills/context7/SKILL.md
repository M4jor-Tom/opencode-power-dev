---
name: context7
description: Fetch current library/API documentation for syntax, migration, configuration or debugging before answering; prefer this over memory or generic web search.
---

# Context7

The native remote MCP server `context7` is declared in this profile's `opencode.json`.

For library, framework, SDK, CLI and cloud documentation questions:
1. Call `context7_resolve-library-id` with `libraryName` and the full `query` (unless the user gave an exact `/org/project` ID).
2. Pick the best exact/relevant match; retry alternate spelling if needed.
3. Call `context7_query-docs` with `libraryId` and the full `query`.
4. Answer from returned documentation. If MCP is unavailable, say so and label any web-search fallback potentially stale.

Do not call it for general programming concepts or local business-logic debugging.
