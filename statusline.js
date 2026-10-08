#!/usr/bin/env node
// Lightweight Claude Code statusline (no GSD dependency).
// Line 1: model | current todo task | directory | git branch (+staged ~modified)
// Line 2: context usage meter | session cost | lines changed

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function gitExec(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return null;
  }
}

function getGitSegment(dir) {
  try {
    execSync('git rev-parse --git-dir', { cwd: dir, stdio: 'ignore' });
  } catch (e) {
    return '';
  }
  const branch = gitExec('git branch --show-current', dir) || gitExec('git rev-parse --short HEAD', dir);
  if (!branch) return '';

  const stagedOut = gitExec('git diff --cached --numstat', dir);
  const modifiedOut = gitExec('git diff --numstat', dir);
  const staged = stagedOut ? stagedOut.split('\n').filter(Boolean).length : 0;
  const modified = modifiedOut ? modifiedOut.split('\n').filter(Boolean).length : 0;

  let status = '';
  if (staged) status += ` \x1b[32m+${staged}\x1b[0m`;
  if (modified) status += ` \x1b[33m~${modified}\x1b[0m`;

  return ` \x1b[2m│\x1b[0m \x1b[36m${branch}\x1b[0m${status}`;
}

// Context meter thresholds, in % of the real context window.
const CTX_WARN_PCT = 20;
const CTX_ACT_PCT = 35;
const CTX_DUMB_PCT = 50;
// Cache alerts: warn this many seconds before expiry; ignore cold caches below this size.
const CACHE_WARN_SECONDS = 300;
const CACHE_COLD_MIN_TOKENS = 50_000;

// Shown only when it matters: cache about to expire, or already cold with a big
// context (the next message re-pays the whole context at the cache-write rate).
function getCacheAlert(cache) {
  if (!cache || !cache.caching_observed || !cache.expires_at) return '';
  const left = cache.expires_at - Date.now() / 1000;
  if (left > 0 && left <= CACHE_WARN_SECONDS) {
    return `\x1b[33mcache esfria em ${Math.max(1, Math.ceil(left / 60))}min\x1b[0m`;
  }
  const tokens = cache.recache_tokens_if_cold || 0;
  if (left <= 0 && tokens >= CACHE_COLD_MIN_TOKENS) {
    return `\x1b[33mcache frio · ${Math.round(tokens / 1000)}k a repagar\x1b[0m`;
  }
  return '';
}

function formatCost(costUsd) {
  if (costUsd == null) return '';
  const val = costUsd < 0.01 && costUsd > 0 ? costUsd.toFixed(4) : costUsd.toFixed(2);
  return ` \x1b[2m│\x1b[0m \x1b[32m$${val}\x1b[0m`;
}

function formatLinesChanged(added, removed) {
  if (!added && !removed) return '';
  const parts = [];
  if (added) parts.push(`\x1b[32m+${added}\x1b[0m`);
  if (removed) parts.push(`\x1b[31m-${removed}\x1b[0m`);
  return ` \x1b[2m│\x1b[0m ${parts.join(' ')}`;
}

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const model = data.model?.display_name || 'Claude';
    const dir = data.workspace?.current_dir || process.cwd();
    const session = data.session_id || '';
    const ctxWin = data.context_window;
    const rawUsed = ctxWin?.used_percentage ?? (ctxWin?.remaining_percentage != null ? 100 - ctxWin.remaining_percentage : null);

    // Real share of the context window in use. Thresholds warn early: cache
    // reads cost more per turn as the context grows, and quality drops past ~50%.
    let ctx = '';
    if (rawUsed != null) {
      const used = Math.max(0, Math.min(100, Math.round(rawUsed)));
      const filled = Math.floor(used / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
      const hint = text => ` \x1b[2m${text}\x1b[0m`;

      if (used < CTX_WARN_PCT) {
        ctx = `\x1b[32m${bar} ${used}%\x1b[0m`;
      } else if (used < CTX_ACT_PCT) {
        ctx = `\x1b[33m${bar} ${used}%\x1b[0m${hint('considere /compact')}`;
      } else if (used < CTX_DUMB_PCT) {
        ctx = `\x1b[38;5;208m${bar} ${used}%\x1b[0m${hint('/compact ou /clear')}`;
      } else {
        ctx = `\x1b[5;31m💀 ${bar} ${used}%\x1b[0m${hint('/clear (antes /handoff)')}`;
      }
    }

    const effort = data.effort?.level;
    const effortSeg = effort ? ` \x1b[2m${effort}\x1b[0m` : '';
    const cacheSeg = getCacheAlert(data.prompt_cache);

    let task = '';
    const homeDir = os.homedir();
    const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(homeDir, '.claude');
    const todosDir = path.join(claudeDir, 'todos');
    if (session && fs.existsSync(todosDir)) {
      try {
        const files = fs.readdirSync(todosDir)
          .filter(f => f.startsWith(session) && f.includes('-agent-') && f.endsWith('.json'))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime);

        if (files.length > 0) {
          const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
          const inProgress = todos.find(t => t.status === 'in_progress');
          if (inProgress) task = inProgress.activeForm || '';
        }
      } catch (e) {
        // Silent fail — don't break statusline
      }
    }

    const dirname = path.basename(dir);
    const modelSeg = `\x1b[2m${model}\x1b[0m${effortSeg}`;
    const dirSeg = `\x1b[2m${dirname}\x1b[0m`;
    const middle = task ? ` \x1b[2m│\x1b[0m \x1b[1m${task}\x1b[0m` : '';
    const gitSeg = getGitSegment(dir);

    const cost = data.cost?.total_cost_usd;
    const linesAdded = data.cost?.total_lines_added;
    const linesRemoved = data.cost?.total_lines_removed;
    const costSeg = formatCost(cost);
    const linesSeg = formatLinesChanged(linesAdded, linesRemoved);

    const line1 = `${modelSeg}${middle} \x1b[2m│\x1b[0m ${dirSeg}${gitSeg}`;
    const line2Parts = [ctx, costSeg.replace(/^ \x1b\[2m│\x1b\[0m /, ''), linesSeg.replace(/^ \x1b\[2m│\x1b\[0m /, ''), cacheSeg]
      .filter(Boolean)
      .join(' \x1b[2m│\x1b[0m ');

    process.stdout.write(line2Parts ? `${line1}\n${line2Parts}` : line1);
  } catch (e) {
    // Silent fail — don't break statusline
  }
});
