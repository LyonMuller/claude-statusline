# claude-statusline

A lightweight, dependency-free status line for [Claude Code](https://claude.com/claude-code). Single Node.js script, no external packages, no plugin framework — just drop it in and point `settings.json` at it.

```
Sonnet 5 │ workstation │ fix/create-op-token-cross-account ~1
█████░░░░░ 50% │ $1.23 │ +42 -7
```

**Line 1**: model name │ current in-progress todo (if any) │ working directory │ git branch, with `+N` staged (green) and `~N` modified (yellow) file counts

**Line 2**: context window usage meter (color-coded: green → yellow → orange → red) │ session cost in USD │ lines changed (`+added` / `-removed`)

Every segment degrades gracefully — outside a git repo the branch segment disappears, before any cost data exists the `$` segment disappears, and so on. Nothing ever throws or breaks the status line.

## Requirements

- [Claude Code](https://claude.com/claude-code)
- Node.js available as `node` in `PATH`
- `git` (optional — only needed for the branch/status segment)

## Install

1. Clone this repo (or just download `statusline.js`) somewhere permanent, e.g.:

   ```bash
   git clone https://github.com/LyonMuller/claude-statusline.git ~/.claude/statusline
   ```

2. Add a `statusLine` entry to your Claude Code settings (`~/.claude/settings.json` for a global setup, or a project's `.claude/settings.json` to scope it to one project):

   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "node \"/Users/you/.claude/statusline/statusline.js\""
     }
   }
   ```

   Use the absolute path to wherever you cloned/copied `statusline.js`.

3. Restart Claude Code (or start a new session) for the change to take effect.

## Customize

Everything lives in one file, `statusline.js`, with no build step:

- **Context meter thresholds/colors** — edit the `used < 50 / 65 / 80` branches near the top of the `stdin.on('end', ...)` handler.
- **Cost formatting** — `formatCost()`.
- **Lines-changed formatting** — `formatLinesChanged()`.
- **Git segment** (branch + staged/modified counts) — `getGitSegment()`.
- **Layout / segment order** — the `line1` / `line2Parts` assembly at the bottom of the handler.

The script reads a single JSON object from stdin on every render — see [Claude Code's status line docs](https://code.claude.com/docs/en/statusline) for the full list of available fields (git PR info, worktree info, output style, API duration, etc.) if you want to add more segments.

## Why this exists

Claude Code's status line hook receives a JSON payload on stdin and expects plain text (with optional ANSI colors) on stdout — no framework required. This script keeps that contract as simple as possible: one file, one dependency (Node's stdlib + `git` CLI), so it's trivial to carry across machines.

## License

MIT
