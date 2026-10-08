# claude-statusline

A lightweight, dependency-free status line for [Claude Code](https://claude.com/claude-code). Single Node.js script, no external packages, no plugin framework — just drop it in and point `settings.json` at it.

```
Sonnet 5.5 medium │ workstation │ fix/create-op-token-cross-account ~1
████░░░░░░ 40% /compact ou /clear │ $1.23 │ +42 -7 │ cache esfria em 3min
```

**Line 1**: model name + reasoning effort │ current in-progress todo (if any) │ working directory │ git branch, with `+N` staged (green) and `~N` modified (yellow) file counts

**Line 2**: context window usage meter │ session cost in USD │ lines changed (`+added` / `-removed`) │ prompt-cache alert (only when it matters)

The meter uses the real share of the context window (`context_window.used_percentage`) and tells you what to do:

| Used | Color | Hint |
|---|---|---|
| < 20% | green | none |
| 20–35% | yellow | `considere /compact` |
| 35–50% | orange | `/compact ou /clear` |
| ≥ 50% | red, blinking | `/clear (antes /handoff)` |

Each turn re-reads the whole context from cache, so long sessions cost more per message and answer worse past ~50%.

The cache alert appears only when the prompt cache expires in 5 minutes or less (`cache esfria em Nmin`), or is already cold with 50k+ tokens to re-pay (`cache frio · 137k a repagar`).

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

- **Context meter thresholds/colors/hints** — `CTX_WARN_PCT`, `CTX_ACT_PCT` and `CTX_DUMB_PCT` at the top, and the branches in the `stdin.on('end', ...)` handler.
- **Cache alert** — `getCacheAlert()`, `CACHE_WARN_SECONDS` and `CACHE_COLD_MIN_TOKENS`.
- **Cost formatting** — `formatCost()`.
- **Lines-changed formatting** — `formatLinesChanged()`.
- **Git segment** (branch + staged/modified counts) — `getGitSegment()`.
- **Layout / segment order** — the `line1` / `line2Parts` assembly at the bottom of the handler.

The script reads a single JSON object from stdin on every render — see [Claude Code's status line docs](https://code.claude.com/docs/en/statusline) for the full list of available fields (git PR info, worktree info, output style, API duration, etc.) if you want to add more segments.

## Why this exists

Claude Code's status line hook receives a JSON payload on stdin and expects plain text (with optional ANSI colors) on stdout — no framework required. This script keeps that contract as simple as possible: one file, one dependency (Node's stdlib + `git` CLI), so it's trivial to carry across machines.

## License

MIT
