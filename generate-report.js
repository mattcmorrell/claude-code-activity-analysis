#!/usr/bin/env node
/**
 * generate-report.js — Reads Claude Code session JSONL logs and generates
 * team_report.html with usage metrics across multiple time ranges.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Pricing (Opus 4.6) ──────────────────────────────────────────────────
const PRICE_CACHE_READ  = 0.50 / 1e6;
const PRICE_CACHE_WRITE = 6.25 / 1e6;
const PRICE_FRESH_INPUT = 5.00 / 1e6;
const PRICE_OUTPUT      = 25.00 / 1e6;

// ── Constants ────────────────────────────────────────────────────────────
const IDLE_THRESHOLD_SEC = 300;  // 5 minutes
const MISS_WRITE_RATIO   = 0.5;

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const OUTPUT_DIR   = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
const OUTPUT_FILE  = path.join(OUTPUT_DIR, 'team_report.html');

const RANGES = [
  { key: '7d',  label: 'Last 7 days',  days: 7 },
  { key: '14d', label: 'Last 14 days', days: 14 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time',     days: null },
];

// ── Helpers ──────────────────────────────────────────────────────────────
function fmtDate(d) {
  // "2026-05-07"
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDateShort(d) {
  // "Jun 4"
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function fmtDateShortFromStr(s) {
  // "2026-06-04" -> "Jun 4"
  const d = new Date(s + 'T00:00:00');
  return fmtDateShort(d);
}

function turnCost(turn) {
  return (turn.fresh * PRICE_FRESH_INPUT) +
         (turn.cacheRead * PRICE_CACHE_READ) +
         (turn.cacheWrite * PRICE_CACHE_WRITE) +
         (turn.output * PRICE_OUTPUT);
}

function isCliff(turn) {
  if (turn.gapSec <= IDLE_THRESHOLD_SEC) return false;
  const total = turn.cacheRead + turn.cacheWrite;
  if (total === 0) return false;
  return (turn.cacheWrite / total) > MISS_WRITE_RATIO;
}

function cliffPenalty(turn) {
  const warmCost = (turn.cacheRead + turn.cacheWrite) * PRICE_CACHE_READ;
  const actualCost = turn.cacheWrite * PRICE_CACHE_WRITE + turn.cacheRead * PRICE_CACHE_READ;
  return Math.max(0, actualCost - warmCost);
}

// ── Parse all session JSONL files ────────────────────────────────────────
function parseAllSessions() {
  const sessions = [];

  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error('No projects directory found at', PROJECTS_DIR);
    process.exit(1);
  }

  const projectDirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const projDir of projectDirs) {
    const projPath = path.join(PROJECTS_DIR, projDir);
    let entries;
    try {
      entries = fs.readdirSync(projPath, { withFileTypes: true });
    } catch { continue; }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
      // Skip subagent files (they live inside UUID/ subdirs)
      // Top-level .jsonl files are what we want
      const sessionId = entry.name.replace('.jsonl', '');
      const filePath = path.join(projPath, entry.name);

      try {
        const turns = parseSessionFile(filePath);
        if (turns.length > 0) {
          sessions.push({ id: sessionId, turns });
        }
      } catch (e) {
        // Skip files that can't be parsed
      }
    }
  }

  return sessions;
}

function parseSessionFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const turns = [];
  let prevTs = null;

  for (const line of lines) {
    let d;
    try { d = JSON.parse(line); } catch { continue; }

    if (d.type !== 'assistant') continue;
    const u = d.message?.usage;
    if (!u) continue;
    const ts = d.timestamp;
    if (!ts) continue;

    const tsMs = new Date(ts).getTime();
    if (isNaN(tsMs)) continue;

    const fresh      = u.input_tokens || 0;
    const cacheRead  = u.cache_read_input_tokens || 0;
    const cacheWrite = u.cache_creation_input_tokens || 0;
    const output     = u.output_tokens || 0;

    const gapSec = prevTs ? (tsMs - prevTs) / 1000 : 0;
    prevTs = tsMs;

    turns.push({
      ts: tsMs,
      date: ts,
      fresh,
      cacheRead,
      cacheWrite,
      output,
      gapSec,
    });
  }

  return turns;
}

// ── Compute metrics for a time range ─────────────────────────────────────
function computeRange(sessions, cutoffDate) {
  // Filter sessions with at least one turn in range
  const filtered = [];
  for (const sess of sessions) {
    const turnsInRange = cutoffDate
      ? sess.turns.filter(t => t.ts >= cutoffDate.getTime())
      : sess.turns;
    if (turnsInRange.length === 0) continue;
    // Include ALL turns from matching sessions, for accurate session-level metrics
    filtered.push(sess);
  }

  // ── daily ──
  const dailyMap = {};
  for (const sess of filtered) {
    for (const t of sess.turns) {
      if (cutoffDate && t.ts < cutoffDate.getTime()) continue;
      const dateStr = fmtDate(new Date(t.ts));
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { spend: 0, cacheRead: 0, cacheWrite: 0, fresh: 0 };
      }
      dailyMap[dateStr].spend += turnCost(t);
      dailyMap[dateStr].cacheRead += t.cacheRead;
      dailyMap[dateStr].cacheWrite += t.cacheWrite;
      dailyMap[dateStr].fresh += t.fresh;
    }
  }
  const daily = Object.keys(dailyMap).sort().map(date => {
    const d = dailyMap[date];
    const total = d.cacheRead + d.cacheWrite + d.fresh;
    const hitRate = total > 0 ? (d.cacheRead / total) * 100 : 0;
    return {
      date,
      spend: Math.round(d.spend * 100) / 100,
      cache_hit_rate: Math.round(hitRate * 10) / 10,
    };
  });

  // ── miss_sessions ──
  const missSessions = [];
  let totalMissTurnCost = 0;
  let totalMissTurnCount = 0;
  let totalNonMissTurnCost = 0;
  let totalNonMissTurnCount = 0;
  let allTurnCount = 0;
  let totalSpend = 0;
  let totalMissCost = 0;

  for (const sess of filtered) {
    let sessMissCount = 0;
    let sessMissCost = 0;
    let sessTotalCost = 0;
    let sessTurnCount = 0;
    const firstTurnDate = new Date(sess.turns[0].ts);

    for (const t of sess.turns) {
      const cost = turnCost(t);
      sessTotalCost += cost;
      sessTurnCount++;
      allTurnCount++;
      totalSpend += cost;

      if (isCliff(t)) {
        sessMissCount++;
        const penalty = cliffPenalty(t);
        sessMissCost += penalty;
        totalMissCost += penalty;
        totalMissTurnCost += cost;
        totalMissTurnCount++;
      } else {
        totalNonMissTurnCost += cost;
        totalNonMissTurnCount++;
      }
    }

    if (sessMissCount > 0) {
      missSessions.push({
        id: sess.id.substring(0, 15),
        date: fmtDateShort(firstTurnDate),
        total_cost: Math.round(sessTotalCost * 100) / 100,
        miss_count: sessMissCount,
        miss_cost: Math.round(sessMissCost * 100) / 100,
        turns: sessTurnCount,
      });
    }
  }
  missSessions.sort((a, b) => b.miss_cost - a.miss_cost);

  // ── cost_curves (top 15) ──
  const sessionCosts = filtered.map(sess => {
    let total = 0;
    const cumulative = [];
    for (const t of sess.turns) {
      total += turnCost(t);
      cumulative.push(Math.round(total * 10000) / 10000);
    }
    const firstTurnDate = new Date(sess.turns[0].ts);
    return {
      id: sess.id.substring(0, 15),
      date: fmtDateShort(firstTurnDate),
      total: Math.round(total * 100) / 100,
      turns: sess.turns.length,
      cumulative,
    };
  });
  sessionCosts.sort((a, b) => b.total - a.total);
  const costCurves = sessionCosts.slice(0, 15);

  // ── idle_gaps ──
  const idleGaps = [];
  for (const sess of filtered) {
    for (const t of sess.turns) {
      if (!isCliff(t)) continue;
      const d = new Date(t.ts);
      const bucket = t.gapSec >= 3600 ? '>1h' : '5-60m';
      idleGaps.push({
        date: fmtDateShort(d),
        time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        gap_min: Math.round(t.gapSec / 60 * 10) / 10,
        bucket,
        cost: Math.round(cliffPenalty(t) * 100) / 100,
        tokens: t.cacheWrite,
      });
    }
  }
  idleGaps.sort((a, b) => b.cost - a.cost);

  // ── Session size buckets ──
  const sizeBuckets = [
    { label: '< 100K', min: 0, max: 100000, totalCost: 0, totalTurns: 0, sessionCount: 0 },
    { label: '100-200K', min: 100000, max: 200000, totalCost: 0, totalTurns: 0, sessionCount: 0 },
    { label: '> 200K', min: 200000, max: Infinity, totalCost: 0, totalTurns: 0, sessionCount: 0 },
  ];

  for (const sess of filtered) {
    let maxContext = 0;
    let sessTotalCost = 0;
    for (const t of sess.turns) {
      const ctx = t.cacheRead + t.cacheWrite + t.fresh;
      if (ctx > maxContext) maxContext = ctx;
      sessTotalCost += turnCost(t);
    }
    for (const b of sizeBuckets) {
      if (maxContext >= b.min && maxContext < b.max) {
        b.totalCost += sessTotalCost;
        b.totalTurns += sess.turns.length;
        b.sessionCount++;
        break;
      }
    }
  }

  // Compute cost/turn per bucket
  const bucketCostPerTurn = sizeBuckets.map(b => ({
    ...b,
    costPerTurn: b.totalTurns > 0 ? b.totalCost / b.totalTurns : 0,
  }));
  const activeBuckets = bucketCostPerTurn.filter(b => b.totalTurns > 0);
  const maxCostPerTurn = activeBuckets.length > 0 ? Math.max(...activeBuckets.map(b => b.costPerTurn)) : 0;
  const minCostPerTurn = activeBuckets.length > 0 ? Math.min(...activeBuckets.map(b => b.costPerTurn)) : 0;
  const sizeMultiplier = minCostPerTurn > 0 ? maxCostPerTurn / minCostPerTurn : 1;

  // ── Summary stats ──
  const avgMissTurnCost = totalMissTurnCount > 0 ? totalMissTurnCost / totalMissTurnCount : 0;
  const avgNonMissTurnCost = totalNonMissTurnCount > 0 ? totalNonMissTurnCost / totalNonMissTurnCount : 0;
  const missMultiplier = avgNonMissTurnCost > 0 ? Math.round(avgMissTurnCost / avgNonMissTurnCost) : 0;

  const missTurnPct = allTurnCount > 0 ? (totalMissTurnCount / allTurnCount * 100) : 0;
  const missCostPct = totalSpend > 0 ? (totalMissCost / totalSpend * 100) : 0;

  // Gap buckets summary
  const gapBucket5to60 = idleGaps.filter(g => g.bucket === '5-60m');
  const gapBucket1h = idleGaps.filter(g => g.bucket === '>1h');
  const gapBucketsSummary = [];
  if (gapBucket5to60.length > 0) {
    gapBucketsSummary.push({
      label: '5-60m',
      count: gapBucket5to60.length,
      cost: gapBucket5to60.reduce((s, g) => s + g.cost, 0),
    });
  }
  if (gapBucket1h.length > 0) {
    gapBucketsSummary.push({
      label: '>1h',
      count: gapBucket1h.length,
      cost: gapBucket1h.reduce((s, g) => s + g.cost, 0),
    });
  }

  // Date range
  let dateRange = '';
  if (daily.length > 0) {
    const first = fmtDateShortFromStr(daily[0].date);
    const last = fmtDateShortFromStr(daily[daily.length - 1].date);
    const year = daily[daily.length - 1].date.substring(0, 4);
    dateRange = `${first} &ndash; ${last}, ${year}`;
  }

  const totalDays = daily.length || 1;
  const avgPerDay = Math.round(totalSpend / totalDays);

  return {
    daily,
    miss_sessions: missSessions,
    cost_curves: costCurves,
    idle_gaps: idleGaps,

    // For HTML generation
    _summary: {
      dateRange,
      totalSpend: Math.round(totalSpend),
      sessionCount: filtered.length,
      avgPerDay,
      missTurnPct,
      missCostPct,
      totalMissTurnCount,
      totalMissCost: Math.round(totalMissCost),
      missMultiplier,
      sizeMultiplier: Math.round(sizeMultiplier * 10) / 10,
      sizeBuckets: bucketCostPerTurn,
      maxCostPerTurn,
      gapBucketsSummary,
      totalGapCount: idleGaps.length,
      totalGapCost: Math.round(idleGaps.reduce((s, g) => s + g.cost, 0)),
    },
  };
}

// ── HTML generation ──────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtPct(pct) {
  if (pct < 1) return '&lt;1%';
  return Math.round(pct) + '%';
}

function generateRangePanel(rangeKey, data) {
  const s = data._summary;

  // Build the deep-data JSON (without internal _summary)
  const deepData = {
    daily: data.daily,
    miss_sessions: data.miss_sessions,
    cost_curves: data.cost_curves,
    idle_gaps: data.idle_gaps,
  };

  // Turns % and Cost % for bar widths (minimum 2% for visibility)
  const turnBarWidth = Math.max(2, s.missTurnPct).toFixed(1);
  const costBarWidth = Math.max(2, s.missCostPct).toFixed(1);

  // Size bars
  let sizeBarsHtml = '';
  const sizeLabels = ['&lt; 100K', '100&ndash;200K', '&gt; 200K'];
  for (let i = 0; i < s.sizeBuckets.length; i++) {
    const b = s.sizeBuckets[i];
    const pct = s.maxCostPerTurn > 0 ? Math.round(b.costPerTurn / s.maxCostPerTurn * 100) : 0;
    const costPerTurnStr = b.costPerTurn < 0.01 ? '$' + b.costPerTurn.toFixed(3) + '/turn' : '$' + b.costPerTurn.toFixed(2) + '/turn';
    const countStr = b.sessionCount === 1 ? '1 session' : b.sessionCount + ' sessions';
    sizeBarsHtml += `
        <div class="size-row">
          <span class="size-label">${sizeLabels[i]}</span>
          <div class="size-track"><div class="size-fill" style="width:${pct}%"></div></div>
          <span class="size-value">${costPerTurnStr}</span>
          <span class="size-count">${countStr}</span>
        </div>`;
  }

  // Gap buckets
  let gapBucketsHtml = '';
  for (const gb of s.gapBucketsSummary) {
    const costStr = '$' + Math.round(gb.cost);
    let fixText;
    if (gb.label === '5-60m') {
      fixText = `<div class="gap-fix gap-fix-warn">1-hour TTL would prevent these, but its 60% write premium on <em>every</em> cache write costs more than the savings. Best fix: <code>/compact</code> before stepping away, or start a new session when you return.</div>`;
    } else {
      fixText = `<div class="gap-fix gap-fix-warn">Extended cache TTL (<code>"CLAUDE_CODE_USE_EXTENDED_CACHE_TTL": "true"</code>) would cover these gaps. But weigh the 60% write premium against these savings.</div>`;
    }
    const rangeLabel = gb.label === '5-60m' ? '5&ndash;60 min' : '&gt; 1 hour';
    gapBucketsHtml += `
            <div class="gap-bucket">
              <div class="gap-count">${gb.count}</div>
              <div class="gap-detail">
                <div class="gap-range">breaks between ${rangeLabel} &mdash; ${costStr}</div>
                ${fixText}
              </div>
            </div>`;
  }

  return `
  <div class="range-panel" data-range="${rangeKey}">
    <script type="application/json" class="deep-data">${JSON.stringify(deepData)}</script>

    <div class="range-summary">
      <div class="period">${s.dateRange}</div>
      <div class="summary-line">$${s.totalSpend} total &middot; ${s.sessionCount} sessions &middot; $${s.avgPerDay}/day avg</div>
      <a class="drill-link" href="#" data-chart="daily" data-label-closed="See daily breakdown &#8594;" data-label-open="Hide daily breakdown">See daily breakdown &#8594;</a>
    </div>
    <div class="chart-drawer" data-chart="daily"></div>

    <div class="card miss">
      <div class="card-label">Cache Miss Tax</div>
      ${s.totalMissTurnCount > 0 ? `
        <div class="hero-pair">
          <div class="hero-item">
            <div class="hero-num">${fmtPct(s.missTurnPct)}</div>
            <div class="hero-desc">of your turns</div>
          </div>
          <div class="hero-arrow">&rarr;</div>
          <div class="hero-item">
            <div class="hero-num accent-red">${fmtPct(s.missCostPct)}</div>
            <div class="hero-desc">of your spend</div>
          </div>
        </div>
        <div class="bar-compare">
          <div class="bar-row">
            <span class="bar-label">Turns</span>
            <div class="bar-track"><div class="bar-fill neutral" style="width:${turnBarWidth}%"></div></div>
            <span class="bar-pct">${fmtPct(s.missTurnPct)}</span>
          </div>
          <div class="bar-row">
            <span class="bar-label">Cost</span>
            <div class="bar-track"><div class="bar-fill hot" style="width:${costBarWidth}%"></div></div>
            <span class="bar-pct">${fmtPct(s.missCostPct)}</span>
          </div>
        </div>
        <div class="miss-stats">
          ${s.totalMissTurnCount} misses &middot; $${s.totalMissCost} total &middot;
          <strong>${s.missMultiplier}&times;</strong> normal turn cost
        </div>
        <p class="card-text">
          When you step away for 5+ minutes during a session, the prompt cache expires.
          Coming back means rebuilding it from scratch &mdash; and the bigger the session,
          the more expensive the reload.
        </p>` : `
        <div class="good">
          <div class="good-icon">&check;</div>
          <div class="good-text">No cache misses detected in this period.</div>
        </div>`}
      <a class="drill-link" href="#" data-chart="miss-sessions" data-label-closed="See which sessions &#8594;" data-label-open="Hide sessions">See which sessions &#8594;</a>
    </div>
    <div class="chart-drawer" data-chart="miss-sessions"></div>

    <div class="card gaps">
      <div class="card-label">Idle Gap Penalty</div>
      ${s.totalGapCount > 0 ? `
        <div class="hero-single">
          <span class="hero-num">${s.totalGapCount}</span>
          <span class="hero-desc">idle breaks cost you <strong>$${s.totalGapCost}</strong></span>
        </div>
        <div class="gap-buckets">${gapBucketsHtml}</div>` : `
        <div class="good">
          <div class="good-icon">&check;</div>
          <div class="good-text">No idle gaps detected in this period.</div>
        </div>`}
      <a class="drill-link" href="#" data-chart="idle-gaps" data-label-closed="See when gaps happened &#8594;" data-label-open="Hide gap details">See when gaps happened &#8594;</a>
    </div>
    <div class="chart-drawer" data-chart="idle-gaps"></div>

    <div class="card size">
      <div class="card-label">Session Size Impact</div>
      ${s.sizeMultiplier > 1 ? `
        <div class="hero-single">
          <span class="hero-num">${s.sizeMultiplier}&times;</span>
          <span class="hero-desc">more expensive per turn in your largest sessions</span>
        </div>` : `
        <div class="hero-single">
          <span class="hero-num">1&times;</span>
          <span class="hero-desc">sessions are similarly sized</span>
        </div>`}
    <div class="size-bars">${sizeBarsHtml}</div>
    <p class="card-text">
      Every turn re-reads your full conversation context. Bigger context = higher per-turn cost.
      Use <code>/clear</code> at natural breakpoints to keep sessions lean.
    </p>
      <a class="drill-link" href="#" data-chart="cost-curves" data-label-closed="See cost curves &#8594;" data-label-open="Hide cost curves">See cost curves &#8594;</a>
    </div>
    <div class="chart-drawer" data-chart="cost-curves">
      <div class="curves-title">Session Cost Growth &mdash; Top 15</div>
      <canvas class="curves-canvas" style="width:100%;height:400px"></canvas>
      <div class="curves-legend"></div>
      <div class="curves-tooltip"></div>
    </div>

    <div class="card rec">
      <div class="card-label">Recommendation</div>

        <div class="good">
          <div class="good-icon">&check;</div>
          <div class="good-text">
            Your settings match your usage patterns. No changes needed &mdash; keep doing what you&rsquo;re doing.
          </div>
        </div>
    </div>

  </div>`;
}

function generateHtml(rangeData) {
  const now = new Date();
  const timestamp = fmtDate(now) + ' ' + String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

  const rangeTabs = RANGES.map(r =>
    `    <button class="range-btn${r.key === '30d' ? ' active' : ''}" data-range="${r.key}">${r.label}</button>`
  ).join('\n');

  const rangePanels = RANGES.map(r => generateRangePanel(r.key, rangeData[r.key])).join('\n');

  // Set the default active panel
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Token Traction Report</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    background: #0d1117; color: #e6edf3;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 15px; line-height: 1.6;
  }
  .container {
    max-width: 820px; margin: 0 auto;
    padding: 48px 24px 80px;
  }
  .top-title {
    text-align: center; font-size: 28px; font-weight: 700;
    color: #f0f6fc; margin: 0 0 24px;
  }

  /* Range tabs */
  .range-tabs {
    display: flex; gap: 8px; justify-content: center;
    margin-bottom: 32px; flex-wrap: wrap;
  }
  .range-btn {
    background: #21262d; border: 1px solid #30363d;
    color: #8b949e; border-radius: 20px;
    padding: 8px 18px; font-size: 14px;
    cursor: pointer; transition: all 0.2s;
    font-family: inherit;
  }
  .range-btn:hover { color: #e6edf3; border-color: #58a6ff; }
  .range-btn.active {
    background: #58a6ff; border-color: #58a6ff;
    color: #0d1117; font-weight: 600;
  }
  .range-panel { display: none; }
  .range-panel.active { display: block; }
  .range-summary {
    text-align: center; margin-bottom: 48px;
    padding-bottom: 32px; border-bottom: 1px solid #21262d;
  }
  .period { font-size: 16px; color: #8b949e; margin-bottom: 4px; }
  .summary-line { font-size: 14px; color: #656d76; }

  /* Cards */
  .card {
    background: #161b22; border: 1px solid #30363d;
    border-radius: 12px; padding: 32px;
    margin-bottom: 24px; border-left: 4px solid #30363d;
  }
  .card.miss { border-left-color: #f85149; }
  .card.gaps { border-left-color: #d29922; }
  .card.size { border-left-color: #58a6ff; }
  .card.rec { border-left-color: #3fb950; }
  .card.calm { border-left-color: #484f58; }
  .nc-item {
    padding: 14px 0;
    border-bottom: 1px solid #21262d;
  }
  .nc-item:last-child { border-bottom: none; }
  .nc-header {
    display: flex; justify-content: space-between;
    align-items: baseline; margin-bottom: 4px;
  }
  .nc-title { font-size: 15px; font-weight: 600; color: #c9d1d9; }
  .nc-stat { font-size: 15px; font-weight: 700; color: #3fb950; }
  .nc-detail { font-size: 14px; color: #8b949e; line-height: 1.6; }
  .card-label {
    font-size: 12px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 2px;
    color: #8b949e; margin-bottom: 20px;
  }
  .card-text {
    font-size: 14px; color: #9ca3af; line-height: 1.7; margin: 16px 0 0;
  }
  .card-text code {
    background: #21262d; padding: 2px 6px; border-radius: 4px;
    font-size: 13px; color: #79c0ff;
  }

  /* Good state */
  .good {
    display: flex; align-items: center; gap: 16px; padding: 8px 0;
  }
  .good-icon {
    font-size: 28px; color: #3fb950; font-weight: 700;
    min-width: 36px; text-align: center;
  }
  .good-text { font-size: 15px; color: #9ca3af; }

  /* Hero pair (cache miss) */
  .hero-pair {
    display: flex; align-items: center; justify-content: center;
    gap: 24px; margin-bottom: 24px;
  }
  .hero-item { text-align: center; }
  .hero-num {
    font-size: 48px; font-weight: 800; color: #f0f6fc; line-height: 1;
  }
  .hero-num.accent-red { color: #f85149; }
  .hero-desc { font-size: 14px; color: #8b949e; margin-top: 4px; }
  .hero-arrow { font-size: 28px; color: #484f58; margin-top: -20px; }

  /* Bar comparison */
  .bar-compare { margin: 20px 0; }
  .bar-row {
    display: grid; grid-template-columns: 50px 1fr 44px;
    align-items: center; gap: 12px; margin-bottom: 8px;
  }
  .bar-label { font-size: 13px; color: #8b949e; text-align: right; }
  .bar-track {
    height: 24px; background: #21262d; border-radius: 6px; overflow: hidden;
  }
  .bar-fill {
    height: 100%; border-radius: 6px; min-width: 4px;
    animation: grow 0.8s cubic-bezier(.4,0,.2,1) forwards;
  }
  .bar-fill.neutral { background: #484f58; }
  .bar-fill.hot { background: #f85149; }
  @keyframes grow { from { width: 0; } }
  .bar-pct { font-size: 14px; color: #e6edf3; font-weight: 600; }
  .miss-stats {
    font-size: 15px; color: #c9d1d9; text-align: center; margin: 16px 0;
  }
  .miss-stats strong { color: #f85149; }

  /* Hero single */
  .hero-single { margin-bottom: 20px; }
  .hero-single .hero-num {
    font-size: 48px; font-weight: 800; color: #f0f6fc;
    line-height: 1; display: inline;
  }
  .hero-single .hero-desc {
    font-size: 20px; color: #9ca3af; display: inline; margin-left: 12px;
  }
  .hero-single .hero-desc strong { color: #f0f6fc; }

  /* Gap buckets */
  .gap-buckets { margin: 16px 0; }
  .gap-bucket {
    display: flex; gap: 16px; align-items: flex-start;
    padding: 16px 0; border-bottom: 1px solid #21262d;
  }
  .gap-bucket:last-child { border-bottom: none; }
  .gap-count {
    font-size: 28px; font-weight: 800; color: #f0f6fc;
    min-width: 48px; text-align: center; line-height: 1; padding-top: 2px;
  }
  .gap-detail { flex: 1; }
  .gap-range { font-size: 15px; color: #c9d1d9; margin-bottom: 4px; }
  .gap-fix { font-size: 14px; color: #3fb950; font-weight: 500; }
  .gap-fix-warn { color: #d29922; font-weight: 400; }
  .gap-fix-warn em { font-style: italic; }
  .gap-fix-warn code {
    background: #21262d; padding: 2px 6px; border-radius: 4px;
    font-size: 13px; color: #79c0ff;
  }
  .gap-fix code {
    background: #21262d; padding: 2px 6px; border-radius: 4px;
    font-size: 13px; color: #79c0ff;
  }

  /* Size bars */
  .size-bars { margin: 16px 0; }
  .size-row {
    display: grid; grid-template-columns: 80px 1fr 90px 80px;
    align-items: center; gap: 12px; margin-bottom: 8px;
  }
  .size-label { font-size: 13px; color: #8b949e; text-align: right; }
  .size-track {
    height: 20px; background: #21262d; border-radius: 5px; overflow: hidden;
  }
  .size-fill {
    height: 100%; background: #58a6ff; border-radius: 5px; min-width: 4px;
    animation: grow 0.8s cubic-bezier(.4,0,.2,1) forwards;
  }
  .size-value { font-size: 14px; color: #e6edf3; font-weight: 600; }
  .size-count { font-size: 13px; color: #656d76; }

  /* Recommendation */
  .rec-priority {
    font-size: 12px; font-weight: 700; color: #3fb950;
    letter-spacing: 2px; margin-bottom: 8px;
  }
  .rec-title {
    font-size: 22px; font-weight: 700; color: #f0f6fc; margin: 0 0 16px;
  }
  .rec-detail {
    font-size: 14px; color: #9ca3af; line-height: 1.7; margin: 0 0 20px;
  }
  .setting-block {
    background: #0d1117; border: 1px solid #30363d; border-radius: 8px;
    padding: 16px 20px; position: relative;
  }
  .setting-block code {
    color: #79c0ff; font-size: 13px; white-space: pre-wrap; line-height: 1.8;
  }
  .copy-btn {
    position: absolute; top: 10px; right: 10px;
    background: #21262d; border: 1px solid #30363d; color: #8b949e;
    border-radius: 6px; padding: 4px 12px; font-size: 12px; cursor: pointer;
  }
  .copy-btn:hover { color: #e6edf3; border-color: #58a6ff; }
  .also-consider {
    margin-top: 20px; padding-top: 16px; border-top: 1px solid #21262d;
  }
  .also-label {
    font-size: 12px; font-weight: 600; color: #8b949e;
    text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;
  }
  .also-consider ul { margin: 0; padding-left: 20px; }
  .also-consider li {
    font-size: 14px; color: #9ca3af; margin-bottom: 6px; line-height: 1.5;
  }
  .also-consider li strong { color: #c9d1d9; }

  /* Explainer */
  details { margin-top: 32px; }
  details summary {
    font-size: 14px; color: #8b949e; cursor: pointer; padding: 8px 0;
  }
  details summary:hover { color: #c9d1d9; }
  .explainer {
    font-size: 14px; color: #656d76; line-height: 1.7; padding: 16px 0;
  }
  .explainer p { margin: 0 0 12px; }
  .explainer strong { color: #8b949e; }
  .explainer code {
    background: #21262d; padding: 2px 6px; border-radius: 4px;
    font-size: 13px; color: #79c0ff;
  }

  .footer {
    text-align: center; color: #484f58; font-size: 13px;
    margin-top: 40px; padding-top: 16px; border-top: 1px solid #21262d;
  }


  /* Drill-down links */
  .drill-link {
    display: inline-block;
    margin-top: 16px;
    font-size: 14px;
    color: #58a6ff;
    cursor: pointer;
    text-decoration: none;
  }
  .drill-link:hover { color: #79c0ff; }

  /* Chart drawers */
  .chart-drawer {
    display: none;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
    animation: drawerIn 0.3s ease;
  }
  .chart-drawer.open { display: block; }
  @keyframes drawerIn {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .daily-chart-title {
    font-size: 12px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 1.5px;
    color: #8b949e; margin-bottom: 16px;
  }
  .daily-row {
    display: grid;
    grid-template-columns: 50px 1fr 70px;
    align-items: center; gap: 12px; margin-bottom: 4px;
  }
  .daily-date { font-size: 13px; color: #8b949e; text-align: right; }
  .daily-track {
    height: 24px; background: #21262d;
    border-radius: 6px; overflow: hidden;
  }
  .daily-fill {
    height: 100%; background: #58a6ff;
    border-radius: 6px; min-width: 4px;
    display: flex; align-items: center;
    padding-left: 8px; font-size: 13px;
    color: #0d1117; font-weight: 600; white-space: nowrap;
  }
  .daily-amount {
    font-size: 14px; color: #e6edf3;
    font-weight: 600; text-align: right;
  }

  .hitrate-chart { margin-top: 32px; }
  .hitrate-row { display: flex; gap: 3px; flex-wrap: wrap; }
  .hitrate-cell {
    padding: 6px 10px; border-radius: 4px;
    font-size: 13px; font-weight: 600;
    color: #0d1117; text-align: center; min-width: 44px;
  }
  .hitrate-dates {
    display: flex; justify-content: space-between;
    font-size: 13px; color: #656d76; margin-top: 8px;
  }

  .miss-table { display: flex; flex-direction: column; gap: 12px; }
  .miss-row {
    background: #0d1117; border: 1px solid #21262d;
    border-radius: 8px; padding: 16px;
  }
  .miss-meta { display: flex; gap: 12px; margin-bottom: 8px; }
  .miss-date { font-size: 14px; font-weight: 600; color: #c9d1d9; }
  .miss-id { font-size: 13px; color: #656d76; font-family: 'SF Mono', monospace; }
  .miss-bar-track {
    height: 8px; background: #21262d;
    border-radius: 4px; overflow: hidden; margin-bottom: 8px;
  }
  .miss-bar-fill {
    height: 100%; background: #f85149;
    border-radius: 4px; min-width: 4px;
  }
  .miss-nums { display: flex; justify-content: space-between; font-size: 14px; }
  .miss-count { color: #8b949e; }
  .miss-cost { color: #f85149; font-weight: 600; }

  .idle-gaps-table {
    width: 100%; border-collapse: collapse;
    font-size: 14px;
  }
  .idle-gaps-table th {
    text-align: left; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 1px;
    color: #656d76; padding: 8px 12px;
    border-bottom: 1px solid #30363d;
  }
  .idle-gaps-table td {
    padding: 10px 12px; border-bottom: 1px solid #21262d;
    color: #c9d1d9;
  }
  .idle-gaps-table tr:last-child td { border-bottom: none; }
  .gap-time { font-family: 'SF Mono', SFMono-Regular, monospace; color: #8b949e; }
  .gap-dur { font-weight: 600; }
  .gap-tag {
    display: inline-block; padding: 2px 8px;
    border-radius: 12px; font-size: 12px; font-weight: 600;
  }
  .gap-tag-5m { background: rgba(210, 153, 34, 0.15); color: #d29922; }
  .gap-tag-1h { background: rgba(248, 81, 73, 0.15); color: #f85149; }
  .gap-rebuild-cost { font-weight: 600; color: #f85149; white-space: nowrap; }
  .gap-tokens { font-family: 'SF Mono', SFMono-Regular, monospace; font-size: 13px; color: #8b949e; white-space: nowrap; }
  .gap-bar-cell { width: 30%; min-width: 80px; }
  .gap-bar-track { height: 8px; background: #21262d; border-radius: 4px; overflow: hidden; }
  .gap-bar-fill { height: 100%; background: #f85149; border-radius: 4px; min-width: 4px; }

  .curves-title {
    font-size: 14px; font-weight: 600; color: #c9d1d9;
    margin-bottom: 12px;
  }
  .curves-canvas { width: 100%; height: 400px; display: block; cursor: crosshair; }
  .curves-legend {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 6px 16px; margin-top: 16px;
  }
  .curve-legend-item {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: #8b949e;
    cursor: pointer; padding: 4px 8px;
    border-radius: 4px; transition: background 0.15s;
  }
  .curve-legend-item:hover { background: #21262d; }
  .curve-legend-item.dimmed { opacity: 0.3; }
  .curve-swatch {
    width: 20px; height: 3px; border-radius: 2px; flex-shrink: 0;
  }
  .curves-tooltip {
    display: none; position: fixed;
    background: #30363d; border: 1px solid #484f58;
    border-radius: 6px; padding: 10px 14px;
    font-size: 13px; color: #e6edf3;
    pointer-events: none; z-index: 100;
    line-height: 1.6; max-width: 280px;
  }
  .no-data {
    font-size: 14px; color: #656d76;
    text-align: center; padding: 32px 0;
  }


  @media (max-width: 640px) {
    .hero-num { font-size: 36px; }
    .hero-pair { gap: 16px; }
    .size-row { grid-template-columns: 70px 1fr 80px; }
    .size-count { display: none; }
  }
</style>
</head>
<body>
<div class="container">
  <h1 class="top-title">Token Traction Report</h1>

  <nav class="range-tabs">
${rangeTabs}
  </nav>

${rangePanels}

  <details>
    <summary>How does this work?</summary>
    <div class="explainer">
      <p><strong>Prompt caching:</strong> Claude Code saves your conversation in a cache so it doesn&rsquo;t
      have to re-read everything on every turn. By default, this cache expires after <strong>5 minutes</strong>
      of inactivity. You can extend it to <strong>1 hour</strong> by adding
      <code>"CLAUDE_CODE_USE_EXTENDED_CACHE_TTL": "true"</code> to your Claude Code settings.</p>
      <p><strong>Cache expiry:</strong> When the cache expires (you were idle too long), Claude has to
      rebuild it from scratch. This is expensive &mdash; writing to cache costs
      12.5&times; more than reading from it. This is the main source of &ldquo;wasted&rdquo; spend.</p>
      <p><strong>Why big sessions cost more:</strong> Every turn reads your full conversation.
      A session at 200K tokens reads all 200K per turn. At $0.50/MTok, that&rsquo;s $0.10 just
      in reads &mdash; before Claude even responds.</p>
      <p><strong>The 5-minute rule:</strong> If you&rsquo;re in a long session and need a break, either
      extend the cache timeout to 1 hour (see above), or type <code>/compact</code> before
      stepping away to shrink the session. If you&rsquo;ll be gone a while, <code>/clear</code>
      starts fresh &mdash; cheaper than Claude reloading a huge conversation.</p>
    </div>
  </details>

  <div class="footer">
    Generated by Claude Code Usage Advisor &middot; ${timestamp}
  </div>
</div>

<script>
document.querySelectorAll('.range-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var range = this.getAttribute('data-range');
    document.querySelectorAll('.range-btn').forEach(function(b) { b.classList.remove('active'); });
    document.querySelectorAll('.range-panel').forEach(function(p) { p.classList.remove('active'); });
    this.classList.add('active');
    document.querySelector('.range-panel[data-range="' + range + '"]').classList.add('active');
  });
});

function copyCmd(btn) {
  var code = btn.parentElement.querySelector('code');
  var text = code.textContent || code.innerText;
  navigator.clipboard.writeText(text).then(function() {
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
  });
}


document.addEventListener('click', function(e) {
  var link = e.target.closest('.drill-link');
  if (!link) return;
  e.preventDefault();
  var chartId = link.getAttribute('data-chart');
  var panel = link.closest('.range-panel');
  var drawer = panel.querySelector('.chart-drawer[data-chart="' + chartId + '"]');
  if (drawer.classList.contains('open')) {
    drawer.classList.remove('open');
    link.textContent = link.getAttribute('data-label-closed');
  } else {
    drawer.classList.add('open');
    link.textContent = link.getAttribute('data-label-open');
    initChart(drawer, chartId, panel);
  }
});

function initChart(drawer, chartId, panel) {
  if (drawer.getAttribute('data-init')) return;
  drawer.setAttribute('data-init', '1');
  var data = JSON.parse(panel.querySelector('.deep-data').textContent);
  requestAnimationFrame(function() {
    if (chartId === 'daily') renderDailySpend(drawer, data.daily);
    else if (chartId === 'miss-sessions') renderMissSessions(drawer, data.miss_sessions);
    else if (chartId === 'idle-gaps') renderIdleGaps(drawer, data.idle_gaps);
    else if (chartId === 'cost-curves') renderCostCurves(drawer, data.cost_curves);
  });
}

function renderDailySpend(el, daily) {
  if (!daily.length) { el.innerHTML = '<div class="no-data">No daily data.</div>'; return; }
  var max = Math.max.apply(null, daily.map(function(d) { return d.spend; }));
  var h = '<div class="daily-chart-title">DAILY SPEND (ACTUAL)</div>';
  daily.forEach(function(d) {
    var pct = max > 0 ? (d.spend / max * 100) : 0;
    var dateLabel = d.date.slice(5);
    var inner = pct > 20 ? '$' + d.spend.toFixed(2) : '';
    h += '<div class="daily-row"><span class="daily-date">' + dateLabel + '</span>' +
      '<div class="daily-track"><div class="daily-fill" style="width:' + pct.toFixed(1) + '%">' + inner + '</div></div>' +
      '<span class="daily-amount">$' + d.spend.toFixed(2) + '</span></div>';
  });
  h += '<div class="hitrate-chart"><div class="daily-chart-title">DAILY CACHE HIT RATE (TOKEN-WEIGHTED)</div><div class="hitrate-row">';
  daily.forEach(function(d) {
    var r = d.cache_hit_rate;
    var bg = r >= 95 ? '#3fb950' : r >= 90 ? '#56d364' : r >= 85 ? '#d29922' : '#f85149';
    h += '<div class="hitrate-cell" style="background:' + bg + '" title="' + d.date + ': ' + r + '%">' + Math.round(r) + '%</div>';
  });
  h += '</div>';
  if (daily.length > 1) {
    h += '<div class="hitrate-dates"><span>' + daily[0].date + '</span><span>' + daily[daily.length - 1].date + '</span></div>';
  }
  h += '</div>';
  el.innerHTML = h;
}

function renderMissSessions(el, sessions) {
  if (!sessions.length) { el.innerHTML = '<div class="no-data">No sessions with mid-session cache misses.</div>'; return; }
  var maxCost = Math.max.apply(null, sessions.map(function(s) { return s.miss_cost; }));
  var h = '<div class="daily-chart-title">SESSIONS WITH MOST CACHE MISSES</div><div class="miss-table">';
  sessions.forEach(function(s) {
    var pct = maxCost > 0 ? (s.miss_cost / maxCost * 100) : 0;
    h += '<div class="miss-row"><div class="miss-meta"><span class="miss-date">' + s.date + '</span>' +
      '<span class="miss-id">' + s.id + '</span></div>' +
      '<div class="miss-bar-track"><div class="miss-bar-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
      '<div class="miss-nums"><span class="miss-count">' + s.miss_count + ' misses \\u00b7 ' + s.turns + ' turns \\u00b7 $' + s.total_cost.toFixed(2) + ' total</span>' +
      '<span class="miss-cost">$' + s.miss_cost.toFixed(2) + ' from misses</span></div></div>';
  });
  h += '</div>';
  el.innerHTML = h;
}

function renderIdleGaps(el, gaps) {
  if (!gaps || !gaps.length) { el.innerHTML = '<div class="no-data">No idle gaps detected.</div>'; return; }
  var maxCost = Math.max.apply(null, gaps.map(function(g) { return g.cost; }));
  function fmtTok(n) { return n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? Math.round(n/1000)+'K' : n; }
  var h = '<div class="daily-chart-title">IDLE GAPS THAT TRIGGERED CACHE REBUILDS</div>';
  h += '<table class="idle-gaps-table"><thead><tr><th>Date</th><th>Time</th><th>Idle</th><th>Type</th><th>Rebuild Cost</th><th>Tokens</th><th></th></tr></thead><tbody>';
  gaps.forEach(function(g) {
    var dur = g.gap_min >= 60 ? (g.gap_min / 60).toFixed(1) + 'h' : Math.round(g.gap_min) + 'm';
    var cls = g.bucket === '>1h' ? 'gap-tag-1h' : 'gap-tag-5m';
    var label = g.bucket === '>1h' ? '>1 hour' : '5\\u201360 min';
    var pct = maxCost > 0 ? (g.cost / maxCost * 100) : 0;
    var barColor = g.bucket === '>1h' ? '#f85149' : '#d29922';
    h += '<tr><td>' + g.date + '</td><td class="gap-time">' + g.time + '</td>' +
      '<td class="gap-dur">' + dur + '</td>' +
      '<td><span class="gap-tag ' + cls + '">' + label + '</span></td>' +
      '<td class="gap-rebuild-cost" style="color:' + barColor + '">$' + g.cost.toFixed(2) + '</td>' +
      '<td class="gap-tokens">' + fmtTok(g.tokens) + '</td>' +
      '<td class="gap-bar-cell"><div class="gap-bar-track"><div class="gap-bar-fill" style="width:' + pct.toFixed(1) + '%;background:' + barColor + '"></div></div></td></tr>';
  });
  h += '</tbody></table>';
  el.innerHTML = h;
}

function renderCostCurves(el, curves) {
  if (!curves.length) { el.innerHTML = '<div class="no-data">No session data.</div>'; return; }
  var colors = ['#58a6ff','#f85149','#3fb950','#d29922','#bc8cff','#79c0ff','#56d364','#e3b341','#ff7b72','#a5d6ff','#7ee787','#d2a8ff','#ffa657','#ff9bce','#7dcfff'];
  var hidden = {};
  var canvas = el.querySelector('canvas');
  if (!canvas) return;
  var tooltip = el.querySelector('.curves-tooltip');
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var W = canvas.clientWidth;
  var H = canvas.clientHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  var pad = {top: 20, right: 20, bottom: 40, left: 60};
  var pW = W - pad.left - pad.right;
  var pH = H - pad.top - pad.bottom;

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var visible = curves.filter(function(_, i) { return !hidden[i]; });
    if (!visible.length) return;
    var maxTurns = Math.max.apply(null, visible.map(function(c) { return c.cumulative.length; }));
    var maxCost = Math.max.apply(null, visible.map(function(c) { return c.total; })) * 1.05;
    ctx.strokeStyle = '#21262d'; ctx.lineWidth = 1;
    ctx.fillStyle = '#8b949e'; ctx.font = '12px -apple-system, sans-serif'; ctx.textAlign = 'right';
    for (var i = 0; i <= 4; i++) {
      var y = pad.top + (pH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
      ctx.fillText('$' + Math.round(maxCost * (1 - i / 4)), pad.left - 8, y + 4);
    }
    ctx.textAlign = 'center';
    for (var i = 0; i <= 4; i++) {
      var x = pad.left + (pW / 4) * i;
      ctx.fillText(Math.round(maxTurns * i / 4), x, H - pad.bottom + 20);
    }
    ctx.fillText('Turn #', W / 2, H - 4);
    curves.forEach(function(s, idx) {
      if (hidden[idx]) return;
      ctx.strokeStyle = colors[idx % colors.length];
      ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
      ctx.beginPath();
      s.cumulative.forEach(function(val, j) {
        var x = pad.left + (j / Math.max(1, maxTurns - 1)) * pW;
        var y = pad.top + pH - (val / maxCost) * pH;
        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke(); ctx.globalAlpha = 1;
    });
    el._maxTurns = maxTurns;
    el._maxCost = maxCost;
  }

  draw();

  var leg = el.querySelector('.curves-legend');
  if (leg) {
    var lh = '';
    curves.forEach(function(s, idx) {
      lh += '<div class="curve-legend-item" data-idx="' + idx + '"><span class="curve-swatch" style="background:' + colors[idx % colors.length] + '"></span>' + s.date + ' \\u2014 $' + s.total.toFixed(0) + ' (' + s.turns + ' turns)</div>';
    });
    leg.innerHTML = lh;
    leg.addEventListener('click', function(e) {
      var item = e.target.closest('.curve-legend-item');
      if (!item) return;
      var idx = parseInt(item.getAttribute('data-idx'));
      if (hidden[idx]) { delete hidden[idx]; item.classList.remove('dimmed'); }
      else { hidden[idx] = true; item.classList.add('dimmed'); }
      draw();
    });
  }

  canvas.addEventListener('mousemove', function(e) {
    if (!tooltip) return;
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    if (mx < pad.left || mx > W - pad.right || my < pad.top || my > pad.top + pH) {
      tooltip.style.display = 'none'; return;
    }
    var maxTurns = el._maxTurns || 1;
    var maxCost = el._maxCost || 1;
    var turnAtMouse = ((mx - pad.left) / pW) * maxTurns;
    var best = null, bestDist = Infinity;
    curves.forEach(function(s, idx) {
      if (hidden[idx]) return;
      var j = Math.min(Math.round(turnAtMouse), s.cumulative.length - 1);
      if (j < 0) return;
      var val = s.cumulative[j];
      var sy = pad.top + pH - (val / maxCost) * pH;
      var dist = Math.abs(sy - my);
      if (dist < bestDist && dist < 40) {
        bestDist = dist;
        best = {s: s, idx: idx, turn: j, val: val};
      }
    });
    if (best) {
      tooltip.innerHTML = '<div style="color:' + colors[best.idx % colors.length] + ';font-weight:600">' + best.s.date + ' \\u2014 ' + best.s.id + '</div>' +
        'Turn ' + best.turn + ' of ' + best.s.turns + '<br>' +
        '$' + best.val.toFixed(2) + ' cumulative<br>' +
        'Session total: $' + best.s.total.toFixed(2);
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 16) + 'px';
      tooltip.style.top = (e.clientY - 10) + 'px';
    } else {
      tooltip.style.display = 'none';
    }
  });
  canvas.addEventListener('mouseleave', function() {
    if (tooltip) tooltip.style.display = 'none';
  });
}

// Activate default panel
document.querySelector('.range-panel[data-range="30d"]').classList.add('active');
</script>
</body>
</html>`;

  return html;
}

// ── Main ─────────────────────────────────────────────────────────────────
function main() {
  console.log('Parsing session logs from', PROJECTS_DIR, '...');
  const sessions = parseAllSessions();
  console.log(`Found ${sessions.length} sessions`);

  if (sessions.length === 0) {
    console.error('No sessions found. Nothing to generate.');
    process.exit(1);
  }

  const now = new Date();
  const rangeData = {};
  for (const r of RANGES) {
    const cutoff = r.days ? new Date(now.getTime() - r.days * 24 * 60 * 60 * 1000) : null;
    rangeData[r.key] = computeRange(sessions, cutoff);
  }

  let minDate = Infinity, maxDate = -Infinity;
  for (const sess of sessions) {
    for (const t of sess.turns) {
      if (t.ts < minDate) minDate = t.ts;
      if (t.ts > maxDate) maxDate = t.ts;
    }
  }
  const firstDate = fmtDate(new Date(minDate));
  const lastDate = fmtDate(new Date(maxDate));

  const html = generateHtml(rangeData);
  fs.writeFileSync(OUTPUT_FILE, html, 'utf-8');

  const allData = rangeData['all']._summary;
  console.log('');
  console.log(`Report generated: ${OUTPUT_FILE}`);
  console.log(`  Date range: ${firstDate} to ${lastDate}`);
  console.log(`  Total sessions: ${sessions.length}`);
  console.log(`  Total spend: $${allData.totalSpend}`);

  const opener = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start' : 'xdg-open';
  require('child_process').exec(`${opener} "${OUTPUT_FILE}"`);
}

main();
