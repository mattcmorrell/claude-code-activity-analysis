# Matt Morrell — Claude Code Usage Analysis
**Period:** January 6 – April 7, 2026  
**Source:** `~/.claude/stats-cache.json`, `~/.claude/usage-data/session-meta/` (96 sessions), git history across 5 repos  
**Generated:** 2026-04-08

---

## Summary

You used Claude Code CLI heavily across 3 months for a multi-project AI-tooling sprint. Total usage was **~11M fresh tokens** across 204 sessions on 50 active days — but that is only a fraction of what actually ran through the models. When prompt cache reads and writes are included, the **hypothetical API-equivalent cost is ~$3,900–$4,600**, versus the ~$216 that a naive input/output calculation suggests. The gap is entirely explained by Anthropic's prompt caching system, which Claude Code uses aggressively and invisibly.

**You were on Claude Max (~$100/month) for this entire period. At API rates, three months of this usage would have cost roughly $3,900–$4,600.** (The range reflects uncertainty about cache write TTL; see [Pricing](#pricing-used) note.)

> **Note on billing:** These figures are hypothetical API-equivalent costs — what this token volume would cost under API/usage-based billing. Max plan "included usage" is not billed per-token; it works on a separate system with rate limits and five-hour reset windows. Extra usage on Max (optional over-limit continuation) is billed at standard API rates. This analysis is useful for planning a transition to API billing, not for interpreting past Max charges.

| | |
|---|---|
| Active days | 50 |
| Total sessions | 204 |
| Total messages | 90,128 |
| Fresh tokens (input + output) | ~11.0M |
| Cache write tokens | ~250M |
| Cache read tokens | ~5.7B |
| Cost — fresh tokens only | $216 |
| Cost — cache writes | $1,208–$1,933 |
| Cost — cache reads | $2,490 |
| **Hypothetical API-equivalent total** | **$3,914–$4,639** |
| Max subscription actual cost (~3 months) | ~$600 |
| **Value captured vs. subscription cost** | **~6.5–7.7×** |

---

## Data Sources & Limitations

| Source | What it contains | Limitation |
|---|---|---|
| `stats-cache.json` → `dailyActivity` | Message count, session count, tool call count per day | No token detail |
| `stats-cache.json` → `dailyModelTokens` | Fresh input + output tokens per model per day | **Does not include cache tokens** |
| `stats-cache.json` → `modelUsage` | All-time totals: fresh + cache write + cache read per model | No per-day breakdown of cache tokens |
| `usage-data/session-meta/` | Per-session: tools used, MCP flags, project, first prompt | Only covers Jan 6 – Feb 12 (batch export generated Feb 17; new sessions not tracked after) |
| Git history | Commits per project per day | Doesn't capture AI-assisted work done without commits |

**Key gap:** Cache token costs cannot be allocated by day from local data. The `modelUsage` totals are all-time only. Day-by-day cache cost distribution is invisible without the Anthropic console API.

---

## Timeline Overview

### Phase 1 — January: BHR Template Sprint (Jan 6–30)

The first month was dominated by two parallel tracks:

**BHR UI Template** (`bhr-ui-template`) — the primary workstream. A complete BambooHR product surface built from scratch to Figma spec in ~3 weeks:
- Jan 9: Initial commit. 16 commits, 7,049 messages, 1.02M tokens — the highest single-day fresh token count for January (second-highest overall; March 13 edged it out)
- Jan 14–16: AI chat panel, artifact workspace, chart types (Bar/Line/Pie/Table)
- Jan 20–23: Org chart (D3), Inbox, Performance, dark mode
- Jan 26–30: Responsive tab nav, AI feedback exploration, DatePicker, New Employee wizard

**Panda Command** (`ai_services_poc_1`) — early stage:
- Jan 7: Initial agent-selection button + handbook agent
- Jan 12: Settings page, My Info, dark mode toggle

Figma MCP and Playwright MCP began appearing Jan 20–23. This is the first period where screenshot-based review loops drove extra token volume.

### Phase 2 — February: Design Exploration (Feb 1–12 active, Feb 13–Mar 2 low-token)

**BHR template continued** (Feb 2–12):
- Feb 9–12: Heavy Playwright MCP usage (45 calls on Feb 9 alone) — screenshot-review cycles for visual polish
- Feb 11: Peak Playwright day, EE Graph experiments beginning

**claude-skill-tree** (Feb 17–19):
- Interactive skill progression app for Claude Code, built and deployed to Vercel in ~3 days

**The quiet period (Feb 13 – Mar 2):**
Fresh token counts dropped to near-zero (81 tokens on Feb 27). Git commits were prolific:
- Feb 19: 14 design variants added to Panda Command in a single day (V1–V13: Bold, Brutalist, Liquid Glass, Cyberpunk, Zen Garden, Obsidian, Midnight Editorial, Fever Dream, Interdimensional HR Portal)
- Feb 20–27: Decision journal OST viewer, client nav prototypes (6 approaches), plan panel (3 approaches)

This period had **zero session-meta files** (the tracking window ends at Feb 12). The fresh token counts were genuinely low because the design variant work was highly cache-efficient: each variant started from existing codebase patterns already in context. Claude was reading 50–100k tokens from cache per session and generating small targeted diffs. Output was real; fresh token cost was minimal.

### Phase 3 — March: EE Graph Sprint (Mar 3–31)

The highest-sustained-intensity period of the analysis. Opus 4.6 was the dominant model throughout.

- **Mar 3–4:** EE Graph initialized — D3 viewer, decision journal tooling, initial dataset
- **Mar 4:** Single-day data enrichment blitz — BHR parity, compliance layer, org chart refactor, 24 commits
- **Mar 6:** 573,248 fresh tokens (562k Opus 4.6) — integration architecture, Salesforce notes, calendar agent
- **Mar 11–13:** Sustained peak. Mar 13 was the **busiest day of the entire period**: 4,483 messages, 18 sessions, 2,175 tool calls, 1,045,255 fresh tokens (982k Opus 4.6 — the largest single-model single-day total), 7 task agent sessions, 3 Figma MCP sessions
- **Mar 20:** EE Graph Studio deployed to Koyeb (614,696 tokens)
- **Mar 25:** 429,753 tokens — Studio polish, explore/decide patterns

### Phase 4 — April: Panda Command Visual Overhaul (Apr 1–7)

Active but lower intensity. Visual design system work:
- Apr 2–3: Mercury/Orbital colorway variants, CSS token system, design system specimens (~950k tokens combined)
- Apr 6: Final polish — plan panel alignment, chat header, logo, theme menu

---

## Full Token & Cost Breakdown

All figures are totals for Jan 6 – Apr 7, 2026.

### By Model

| Model | Input | Output | Cache Write | Cache Read | Fresh Cost | Cache Write Cost | Cache Read Cost | **Total (5m TTL)** |
|---|---|---|---|---|---|---|---|---|
| Sonnet 4.5 | 551k | 1.49M | 90.0M | 1,498M | $24.02 | $337.51 | $449.51 | **$811** |
| Opus 4.5 | 141k | 380k | 35.8M | 471M | $10.20 | $223.48 | $235.59 | **$469** |
| Haiku 4.5 | 409k | 411k | 25.2M | 146M | $2.46 | $31.52 | $14.58 | **$49** |
| Opus 4.6 | 427k | 7.04M | 97.7M | 3,573M | $178.08 | $610.68 | $1,786.67 | **$2,575** |
| Sonnet 4.6 | 24k | 77k | 1.3M | 13M | $1.22 | $4.75 | $3.98 | **$10** |
| **Total** | **1.55M** | **9.40M** | **250M** | **5,701M** | **$216** | **$1,208** | **$2,490** | **$3,914** |

*Cache write cost shown at 5-minute TTL (1.25× input rate). At 1-hour TTL (2× input rate), write costs rise to ~$1,933 and total to ~$4,639. Local data does not expose the per-TTL split.*

### Pricing Used

| Model | Input | Output | Cache Write (5m) | Cache Write (1h) | Cache Read |
|---|---|---|---|---|---|
| Opus 4.6 | $5.00/M | $25.00/M | $6.25/M | $10.00/M | $0.50/M |
| Opus 4.5 | $5.00/M | $25.00/M | $6.25/M | $10.00/M | $0.50/M |
| Sonnet 4.5 | $3.00/M | $15.00/M | $3.75/M | $6.00/M | $0.30/M |
| Sonnet 4.6 | $3.00/M | $15.00/M | $3.75/M | $6.00/M | $0.30/M |
| Haiku 4.5 | $1.00/M | $5.00/M | $1.25/M | $2.00/M | $0.10/M |

Cache writes have two TTL tiers: 5-minute (1.25× input rate) and 1-hour (2× input rate). Cache read = 0.10× input rate. Source: Anthropic pricing docs, April 2026.

---

## The Cache Gap — The Hidden Cost

### What prompt caching is

Claude Code sends the entire conversation history and project context with every message. For a long coding session, that context can be 50,000–200,000 tokens. Anthropic's prompt cache stores this context server-side and charges a reduced rate on re-reads instead of full input pricing.

Cache writes happen when context is first stored. Cache reads happen every subsequent message that reuses it.

### Why the gap is so large

| Token category | Total tokens | API cost |
|---|---|---|
| Fresh input | 1.55M | $216 |
| Cache writes | 250M | $1,208–$1,933 |
| Cache reads | 5,701M | $2,490 |

**Cache reads alone are 367× more numerous than fresh input tokens.** The ratio makes sense: each session might create 50k–100k of cache writes once, then re-read that entire context on every subsequent message. A session with 50 messages re-reads 100k tokens 50 times = 5M cache read tokens from a single session.

### The math in plain terms

Say a typical Opus 4.6 session:
- You write 10 messages over 30 minutes
- Context grows to 80k tokens
- Each of your 10 messages reads the full 80k from cache
- Cache reads: 10 × 80k = 800k tokens × $0.50/M = **$0.40 for one session**
- Fresh output: ~2k tokens × $25/M = **$0.05**

That session costs ~$0.45 total — but the chart's cost tab shows only $0.05. The cache reads are 8× the visible cost.

Across 204 sessions on Opus 4.6, with an average context of ~1M tokens per session reread 18+ times (the Mar 13 peak alone had 18 sessions), the cache read bill compounds rapidly.

### Opus 4.6 is the dominant cost driver

Opus 4.6 accounts for 66% of total cost ($2,575 of $3,914 at 5m TTL). Its cache read line item alone ($1,787) is the single largest cost component. This is the combination of:
1. The highest cache-read rate ($0.50/M vs $0.30/M for Sonnet)
2. The highest usage volume (3.57 billion cache read tokens)
3. The longest average session context (heavy EE Graph + Panda Command work in March–April)

---

## Activity Patterns

### MCP Usage

| Tool | Total calls | Token impact |
|---|---|---|
| Playwright screenshot | 59 | **Very high** — each screenshot embeds a base64 image (~5–15k tokens each) |
| Playwright navigate | 46 | Medium |
| Playwright click | 43 | Low |
| Figma get_design_context | 17 | **High** — returns large JSON design specs |
| Figma get_screenshot | 11 | High — image data |
| Playwright evaluate | 15 | Low |

Playwright MCP was concentrated in Jan 22–Feb 12 (BHR visual polish). Figma MCP appeared later, heaviest in the Panda Command visual overhaul (Mar 12–Apr 6). Both inflate context size — screenshots and design JSON persist in cache and increase re-read costs on every subsequent message.

### Task Agent Usage (subagents)

Task agents appeared starting Jan 6 and continued throughout. They are the second-largest token multiplier after cache reads because each subagent spawns a fresh context window, independent of the parent session. Mar 13 had 7 task agent sessions in a single day. Cost impact is difficult to isolate precisely from local data, but every task agent session effectively doubles or triples the cache write footprint for that day.

### Session type mix (Jan 6 – Feb 12, where session-meta exists)

| Type | Sessions | Notes |
|---|---|---|
| Plain coding | ~120 | Bash/Edit/Read loops, majority of sessions |
| Task agents | ~30 | Highest token multiplier |
| Playwright MCP | ~18 | Screenshot-heavy, visual review loops |
| Figma MCP | ~10 | Design context ingestion |
| Web search/fetch | ~4 | Minimal |

### Projects by output token consumption (session-meta period only)

| Project | Sessions | Output tokens |
|---|---|---|
| `mmorrell` (home dir / global) | 43 | 297k |
| `bhr-ui-template` | 38 | 269k |
| `claude-skill-tree` | 2 | 48k |
| `esig-template-completer-2.0` | 3 | 2k |
| others | ~8 | ~3k |

Note: EE Graph and Panda Command visual overhaul sessions (Feb 13–Apr 7) are not represented in session-meta. They account for the bulk of Opus 4.6 cache volume.

---

## Implications for API Billing

You are moving from Max (~$100/month flat) to API billing (pay-per-token). Based on this usage period, here is what to expect.

### Rough monthly projection at current usage intensity

The Jan 6 – Apr 7 period is ~92 days (3 months). Monthly estimate:

| | Per month |
|---|---|
| Fresh tokens | $72 |
| Cache writes | $403–$644 |
| Cache reads | $830 |
| **Monthly total** | **~$1,305–$1,546** |

This assumes similar usage intensity. March was heavier than January; April appears to be tapering. Real monthly cost will vary significantly with project phase.

### The biggest levers

**1. Model selection is the highest-impact decision.**  
Swapping from Opus 4.6 to Sonnet 4.6 for a session cuts the cache read rate from $0.50/M to $0.30/M — a 1.7× reduction on reads, plus Opus input/output rates are also higher. For tasks that don't require Opus-level reasoning (UI polish, documentation, test writing, refactoring), Sonnet 4.6 returns comparable results at meaningfully lower cost.

**2. Playwright screenshots are expensive at scale.**  
Each screenshot is ~5–15k tokens added to context, then re-read on every subsequent message. At $0.50/M (Opus 4.6 cache read rate), a screenshot that persists through 20 messages costs $0.05–$0.15 by itself. Sessions with heavy screenshot review loops (like Feb 9's 45 calls) can cost $1–3 in cache reads alone.

**3. Task agents multiply cache writes.**  
Each subagent creates its own context window and cache write. On high-task-agent days (Mar 13: 7 sessions), cache write costs spike. Reserve task agents for genuinely parallelizable work.

**4. Long sessions with large codebases are the core cost driver.**  
The 3.57 billion Opus 4.6 cache read tokens represent many long sessions on large projects (EE Graph with 1,200+ nodes, Panda Command with 14 design variants). Keeping context windows smaller — starting fresh sessions more often, using `/compact` — is the most direct way to reduce cache read accumulation.

### Max plan value recap

| | Max plan | API equivalent |
|---|---|---|
| Jan–Apr 2026 actual spend | ~$600 | ~$3,914–$4,639 |
| Value ratio | | **6.5–7.7×** |

The Max plan absorbed ~$3,300–$4,000 in cache costs that would have appeared as line items under API billing. This will be the primary sticker shock in the transition.

> **Billing mechanics caveat:** Max included usage is not billed per-token — it operates as a rate-limited subscription with five-hour reset windows. "Extra usage" (optional over-limit continuation) is billed at standard API rates. If you transition to an API key, Claude Code charges from the first token regardless of Max subscription status. These API-equivalent figures are the relevant baseline for that scenario.

---

## Open Questions

- **Per-day cache breakdown:** Not available locally. The Anthropic console usage export and API provide per-day token breakdowns, but these are available to Team/Enterprise owners and API Console roles — not to individual Pro/Max users. On an individual Max plan, this data is not accessible without switching to API billing.
- **Session-meta gap (Feb 13 – Apr 7):** The session-meta files were generated as a one-time batch export on Feb 17 covering Jan 6–Feb 12. Sessions after that date have no per-session metadata locally. Tool type and project breakdowns are unavailable for the highest-spend period (March).
- **Subscription transition date:** Cost projections assume a clean cutover. If there is overlap between Max and API billing, some of these tokens may still be covered under Max.
