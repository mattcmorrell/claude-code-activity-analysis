#!/usr/bin/env node
// analyze-cache-cliffs.js
// Analyzes cache cliff patterns across all Claude Code sessions
// Usage: node analyze-cache-cliffs.js [--recent N] [--verbose]

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const RECENT_N = (() => {
  const i = args.indexOf('--recent');
  return i !== -1 ? parseInt(args[i + 1]) : null;
})();
const VERBOSE = args.includes('--verbose');
const JSON_OUT = args.includes('--json');

const PROJECTS_DIR = path.join(process.env.HOME, '.claude', 'projects');
const CLIFF_THRESHOLD_SEC = 300; // 5 minutes
const CLIFF_WRITE_RATIO = 0.5;   // writes > 50% of context = cliff, not just growth

// Opus 4.6 pricing as baseline (most of our usage)
const PRICE_CACHE_READ  = 0.50 / 1e6;  // $/token
const PRICE_CACHE_WRITE = 6.25 / 1e6;  // 5m TTL write price
const PRICE_FRESH_INPUT = 5.00 / 1e6;

function findAllSessionJSONLs() {
  const out = execSync(
    `find "${PROJECTS_DIR}" -name "*.jsonl" -not -path "*/subagents/*" 2>/dev/null`
  ).toString().trim();
  if (!out) return [];
  const files = out.split('\n').filter(Boolean);
  if (RECENT_N) {
    // Sort by mtime descending, take N most recent
    return files
      .map(f => ({ f, mtime: fs.statSync(f).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, RECENT_N)
      .map(x => x.f);
  }
  return files;
}

function classifyTurn(turn, prevTurn) {
  if (!prevTurn) return 'start';
  const { idleSec, cacheRead, cacheWrite } = turn;
  const total = cacheRead + cacheWrite;
  if (total === 0) return 'start';
  const writeRatio = cacheWrite / total;
  const isIdle = idleSec !== null && idleSec > CLIFF_THRESHOLD_SEC;
  if (!isIdle) {
    return writeRatio > CLIFF_WRITE_RATIO ? 'context-growth' : 'warm';
  }
  // Idle gap > 5min: is it a cliff or just incremental?
  return writeRatio > CLIFF_WRITE_RATIO ? 'cliff' : 'warm-after-idle';
}

async function parseSession(file) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: fs.createReadStream(file) });
    const turns = [];
    let lastTs = null;

    rl.on('line', (line) => {
      try {
        const d = JSON.parse(line);
        if (d.type === 'assistant' && d.message?.usage) {
          const u = d.message.usage;
          const ts = d.timestamp;
          const idleSec = lastTs && ts
            ? (new Date(ts) - new Date(lastTs)) / 1000
            : null;
          turns.push({
            ts,
            idleSec,
            fresh:      u.input_tokens || 0,
            cacheRead:  u.cache_read_input_tokens || 0,
            cacheWrite: u.cache_creation_input_tokens || 0,
            write5m:    u.cache_creation?.ephemeral_5m_input_tokens || 0,
            write1h:    u.cache_creation?.ephemeral_1h_input_tokens || 0,
            outputTokens: u.output_tokens || 0,
          });
          lastTs = ts;
        }
      } catch (e) {}
    });

    rl.on('close', () => {
      // Classify turns
      for (let i = 0; i < turns.length; i++) {
        turns[i].type = classifyTurn(turns[i], i > 0 ? turns[i - 1] : null);
      }
      resolve({ file, turns });
    });
  });
}

function estimateCost(turn) {
  return (
    turn.fresh      * PRICE_FRESH_INPUT +
    turn.cacheRead  * PRICE_CACHE_READ +
    turn.cacheWrite * PRICE_CACHE_WRITE
  );
}

function cliffCostPenalty(turn) {
  // Extra cost vs. what a warm turn would have cost (read price on everything)
  const warmCost = (turn.cacheRead + turn.cacheWrite) * PRICE_CACHE_READ;
  const actualCost = turn.cacheWrite * PRICE_CACHE_WRITE + turn.cacheRead * PRICE_CACHE_READ;
  return Math.max(0, actualCost - warmCost);
}

async function main() {
  const files = findAllSessionJSONLs();
  console.log(`\nAnalyzing ${files.length} session files...\n`);

  const sessions = [];
  let processed = 0;

  // Process in batches of 20 to avoid too many open file handles
  for (let i = 0; i < files.length; i += 20) {
    const batch = files.slice(i, i + 20);
    const results = await Promise.all(batch.map(parseSession));
    sessions.push(...results.filter(s => s.turns.length > 0));
    processed += batch.length;
    process.stdout.write(`\r  Parsed ${processed}/${files.length} files...`);
  }
  process.stdout.write('\n\n');

  // Aggregate stats
  let totalTurns = 0, totalCliffs = 0, totalWarm = 0, totalGrowth = 0;
  let write5mTotal = 0, write1hTotal = 0;
  let totalCost = 0, totalCliffPenalty = 0;
  const cliffsBySession = [];

  for (const { file, turns } of sessions) {
    const cliffs = turns.filter(t => t.type === 'cliff');
    const sessionCliffPenalty = cliffs.reduce((s, t) => s + cliffCostPenalty(t), 0);
    const sessionCost = turns.reduce((s, t) => s + estimateCost(t), 0);

    totalTurns    += turns.length;
    totalCliffs   += cliffs.length;
    totalWarm     += turns.filter(t => t.type === 'warm' || t.type === 'warm-after-idle').length;
    totalGrowth   += turns.filter(t => t.type === 'context-growth').length;
    write5mTotal  += turns.reduce((s, t) => s + t.write5m, 0);
    write1hTotal  += turns.reduce((s, t) => s + t.write1h, 0);
    totalCost     += sessionCost;
    totalCliffPenalty += sessionCliffPenalty;

    if (cliffs.length > 0) {
      const dateStr = turns[0]?.ts?.slice(0, 10) ?? 'unknown';
      const project = path.basename(path.dirname(file)).replace(/^-Users-mmorrell-/, '').replace(/-/g, '/');
      cliffsBySession.push({
        project: project.length > 45 ? '...' + project.slice(-42) : project,
        date: dateStr,
        cliffs: cliffs.length,
        turns: turns.length,
        penalty: sessionCliffPenalty,
        maxContextAtCliff: Math.max(...cliffs.map(t => t.cacheRead + t.cacheWrite)),
        longestIdle: Math.max(...cliffs.map(t => t.idleSec || 0)),
      });
    }
  }

  const cliffRate = totalTurns > 0 ? (totalCliffs / totalTurns * 100) : 0;
  const totalWrite = write5mTotal + write1hTotal;

  // ── JSON output mode ──────────────────────────────────────────────────────
  if (JSON_OUT) {
    const byDate = {};
    for (const { turns } of sessions) {
      const date = turns[0]?.ts?.slice(0, 10) ?? 'unknown';
      if (!byDate[date]) byDate[date] = { cliffs: 0, warmTurns: 0, cliffPenalty: 0, totalCost: 0, totalTurns: 0 };
      const d = byDate[date];
      d.totalTurns += turns.length;
      d.totalCost  += turns.reduce((s, t) => s + estimateCost(t), 0);
      for (const t of turns) {
        if (t.type === 'cliff') { d.cliffs++; d.cliffPenalty += cliffCostPenalty(t); }
        else if (t.type === 'warm' || t.type === 'warm-after-idle') d.warmTurns++;
      }
    }
    console.log(JSON.stringify(byDate, null, 2));
    return;
  }

  // ── Overview ──────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  CACHE CLIFF ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`  Sessions analyzed:      ${sessions.length.toLocaleString()}`);
  console.log(`  Total turns:            ${totalTurns.toLocaleString()}`);
  console.log(`  Warm turns:             ${totalWarm.toLocaleString()} (${(totalWarm/totalTurns*100).toFixed(1)}%)`);
  console.log(`  Context-growth turns:   ${totalGrowth.toLocaleString()} (${(totalGrowth/totalTurns*100).toFixed(1)}%)`);
  console.log(`  Cache cliffs:           ${totalCliffs.toLocaleString()} (${cliffRate.toFixed(1)}% of turns)`);
  console.log(`  Sessions with cliffs:   ${cliffsBySession.length}`);
  console.log('');

  // ── Cost ──────────────────────────────────────────────────────────────────
  console.log('  ESTIMATED COST (API pricing, not subscription)');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  Total estimated:        $${totalCost.toFixed(2)}`);
  console.log(`  Cliff penalty (extra):  $${totalCliffPenalty.toFixed(2)} (${(totalCliffPenalty/totalCost*100).toFixed(1)}% of total)`);
  console.log('');

  // ── TTL breakdown ─────────────────────────────────────────────────────────
  console.log('  CACHE TTL BREAKDOWN');
  console.log('  ─────────────────────────────────────────────');
  if (totalWrite > 0) {
    console.log(`  5-min TTL writes:       ${(write5mTotal/1e6).toFixed(1)}M tokens (${(write5mTotal/totalWrite*100).toFixed(0)}%)`);
    console.log(`  1-hour TTL writes:      ${(write1hTotal/1e6).toFixed(1)}M tokens (${(write1hTotal/totalWrite*100).toFixed(0)}%)`);
  }
  console.log('');

  // ── Top sessions by cliff cost ────────────────────────────────────────────
  const top = cliffsBySession.sort((a, b) => b.penalty - a.penalty).slice(0, 15);

  if (top.length > 0) {
    console.log('  TOP SESSIONS BY CLIFF PENALTY COST');
    console.log('  ─────────────────────────────────────────────');
    console.log(`  ${'Date'.padEnd(12)} ${'Cliffs'.padStart(7)} ${'Turns'.padStart(7)} ${'MaxCtx'.padStart(9)} ${'LongestIdle'.padStart(12)} ${'Penalty'.padStart(9)}  Project`);
    console.log(`  ${'─'.repeat(11)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(9)} ${'─'.repeat(12)} ${'─'.repeat(9)}  ${'─'.repeat(30)}`);
    for (const s of top) {
      const ctx = s.maxContextAtCliff > 1e6
        ? (s.maxContextAtCliff/1e6).toFixed(1) + 'M'
        : (s.maxContextAtCliff/1e3).toFixed(0) + 'k';
      const idle = s.longestIdle > 3600
        ? (s.longestIdle/3600).toFixed(1) + 'h'
        : (s.longestIdle/60).toFixed(0) + 'min';
      console.log(
        `  ${s.date.padEnd(12)} ${String(s.cliffs).padStart(7)} ${String(s.turns).padStart(7)}` +
        ` ${ctx.padStart(9)} ${idle.padStart(12)} ${'$' + s.penalty.toFixed(3).padStart(8)}  ${s.project}`
      );
    }
    console.log('');
  }

  // ── Idle gap histogram ────────────────────────────────────────────────────
  const allCliffIdles = [];
  for (const { turns } of sessions) {
    turns.filter(t => t.type === 'cliff').forEach(t => allCliffIdles.push(t.idleSec));
  }

  if (allCliffIdles.length > 0) {
    const buckets = [
      { label: '5-10 min',  lo: 300,   hi: 600   },
      { label: '10-30 min', lo: 600,   hi: 1800  },
      { label: '30-60 min', lo: 1800,  hi: 3600  },
      { label: '1-4 hours', lo: 3600,  hi: 14400 },
      { label: '>4 hours',  lo: 14400, hi: Infinity },
    ];
    console.log('  CLIFF IDLE-GAP DISTRIBUTION');
    console.log('  ─────────────────────────────────────────────');
    for (const b of buckets) {
      const count = allCliffIdles.filter(s => s >= b.lo && s < b.hi).length;
      if (count > 0) {
        const bar = '█'.repeat(Math.ceil(count / Math.max(...buckets.map(bb =>
          allCliffIdles.filter(s => s >= bb.lo && s < bb.hi).length)) * 20));
        console.log(`  ${b.label.padEnd(12)} ${String(count).padStart(4)}  ${bar}`);
      }
    }
    console.log('');
  }

  if (VERBOSE) {
    console.log('  ALL SESSIONS WITH CLIFFS');
    console.log('  ─────────────────────────────────────────────');
    for (const s of cliffsBySession.sort((a, b) => a.date.localeCompare(b.date))) {
      console.log(`  ${s.date}  ${s.cliffs} cliffs / ${s.turns} turns  $${s.penalty.toFixed(3)}  ${s.project}`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error(err); process.exit(1); });
