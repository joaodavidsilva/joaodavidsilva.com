---
name: Markdown Exporter
oneLine: A VS Code extension that turns a hand-picked selection of files and folders into one Markdown document for LLM context.
status: active
version: 1.0.9
published: 2026-11-09
tags: [developer-tools, llm]
links:
  repository: https://github.com/joaodavidsilva/markdown-exporter
  stores:
    - name: Visual Studio Marketplace
      url: https://marketplace.visualstudio.com/items?itemName=joaodavidsilva.markdown-exporter
software:
  category: DeveloperApplication
  operatingSystems: [Visual Studio Code, Cursor, Windsurf, VSCodium]
---

Markdown Exporter is published as "Selection Markdown Exporter". It turns files and folders picked in the VS Code Explorer (or Cursor, Windsurf and VSCodium) into a single, structured Markdown export, ready to paste into an LLM context window, attach to an issue or archive as documentation.

Curation happens in the editor: packing a whole repository is the fallback, not the main workflow.

## What it does

- **Two commands, one pipeline.** *Copy as Markdown* puts the export on the clipboard; *Export to Markdown* writes a timestamped file (`FULL_CODE_YYYY-MM-DD_HH-mm-ss.md`) into the workspace root. Both are in the Explorer context menu and the Command Palette.
- **Annotated file tree.** Each export starts with a file tree that shows an approximate token count per file, measured with the `o200k_base` vocabulary, followed by one language-fenced section per file.
- **Token warning.** When the export finishes, a notification names the destination, the approximate total token cost and the number of redactions; it becomes a warning above `markdownExport.tokenWarningThreshold` (128,000 tokens by default).
- **Layered ignore rules.** Nested `.gitignore` files, then a root `.exportignore`, then the `markdownExport.additionalIgnore` setting, with the last match winning. A file picked explicitly is exported even if an ignore rule matches it.
- **Stubs instead of noise.** Binary, oversized (over 1 MB by default) and unreadable files keep their place in the tree, with a note saying why their content was omitted.
- **Best-effort secret redaction.** Values in `.env` files and recognisable credential formats (AWS, GitHub, Stripe, OpenAI and Anthropic keys, JWTs, database URL passwords) are replaced with `[REDACTED: …]` markers. It is a safety net, not a guarantee: secrets in other formats pass through.

The source code is MIT-licensed and written in TypeScript.
