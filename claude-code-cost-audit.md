# Claude Code Cost Audit — API Billing Period

**Author:** Matt Morrell  
**Date:** April 21, 2026  
**Period:** April 6–21, 2026 (16 active days)  
**Billing:** Enterprise API, $600/month limit (resets May 1)

---

## Executive Summary

$326.54 spent through April 21 — 54% of the $600 monthly limit. On pace to finish around $530 with ~$70 headroom. The single biggest cost driver is not model output but **cache overhead**: 83% of spend goes to re-sending and re-caching conversation context every turn. One session on April 6 ($80) consumed 25% of the month's spend in a single sitting.

---

## Methodology

Claude Code stores every conversation as JSONL files under `~/.claude/projects/`. Each assistant turn includes a `usage` object with:

- `input_tokens` — uncached (fresh) input
- `cache_read_input_tokens` — context served from Anthropic's prompt cache
- `cache_creation_input_tokens` — context written into cache (new or expired)
- `output_tokens` — model response

Published API rates (Opus 4.6: $5/$25/$0.50/$6.25 per MTok for input/output/cache-read/cache-create) produce estimates ~39% above actual billing. Claude Code Enterprise appears to receive a discounted rate. All dollar figures in this report are calibrated against the known $326.54 actual spend using a 0.61x correction factor. Relative proportions and token counts are exact.

This analysis was inspired by [a Reddit post](https://www.reddit.com/r/ClaudeCode/) auditing 858 sessions with similar methodology. Where applicable, findings are compared to that benchmark.

---

## Usage Overview

| Metric                   | Value         |
| ------------------------ | ------------- |
| Sessions                 | 126           |
| Turns                    | 7,298         |
| Active days              | 16 of 16      |
| Avg turns/session        | 58            |
| Median turns/session     | 31            |
| Sessions with 100+ turns | 20            |
| Sessions with 500+ turns | 1             |
| Avg context per turn     | 93,973 tokens |
| Avg cost per turn        | $0.045 (4.5¢) |
| Avg cost per session     | $2.59         |
| Overall cache read ratio | 95.5%         |

---

## Cost Breakdown

### By Category

| Category       | Estimated Cost | Share    | What It Is                                                      |
| -------------- | --------------:| --------:| --------------------------------------------------------------- |
| Cache reads    | $174.48        | 53%      | Re-sending cached context each turn at discounted rate          |
| Cache creation | $98.67         | 30%      | Writing new cache entries when context changes or cache expires |
| Output         | $53.31         | 16%      | The actual model responses                                      |
| Uncached input | $0.09          | <1%      | Fresh input not in cache                                        |
| **Total**      | **$326.54**    | **100%** |                                                                 |

The takeaway: **84% of spend is cache tax** — the cost of the stateless request loop where every turn re-sends the full conversation history. Only 16% pays for Claude's actual responses.

### By Day

| Date   | Est. Cost | Turns | Sessions | Cost/Turn |
| ------ | ---------:| -----:| --------:| ---------:|
| Apr 6  | $138.65   | 1,551 | 5        | 8.9¢      |
| Apr 7  | $4.91     | 130   | 3        | 3.8¢      |
| Apr 8  | $14.86    | 469   | 2        | 3.2¢      |
| Apr 9  | $26.42    | 814   | 9        | 3.2¢      |
| Apr 10 | $14.32    | 496   | 6        | 2.9¢      |
| Apr 13 | $1.59     | 102   | 3        | 1.6¢      |
| Apr 15 | $0.68     | 39    | 3        | 1.7¢      |
| Apr 16 | $4.57     | 152   | 10       | 3.0¢      |
| Apr 17 | $43.98    | 899   | 15       | 4.9¢      |
| Apr 20 | $48.45    | 1,558 | 22       | 3.1¢      |
| Apr 21 | $28.11    | 1,088 | 51       | 2.6¢      |

April 6 alone was 42% of total spend. Cost/turn has trended down from 8.9¢ to 2.6¢ as session patterns shifted from marathon Opus sessions to shorter, mixed-model work.

### By Project

| Project                       | Turns | Est. Cost | Share |
| ----------------------------- | -----:| ---------:| -----:|
| ai-services-poc-1             | 6,719 | $310.78   | 95%   |
| claude-code-activity-analysis | 380   | $11.74    | 4%    |
| All other projects            | 199   | $4.02     | 1%    |

One project accounts for 95% of API-period spend.

### By Model

| Model      | Approx. Cost | Primary Role                       |
| ---------- | ------------:| ---------------------------------- |
| Opus 4.6   | $171.93      | Main workhorse (early period)      |
| Sonnet 4.6 | $109.15      | Increasingly used for routine work |
| Opus 4.7   | $67.69       | Used from Apr 16+                  |
| Haiku 4.5  | $9.81        | Subagent/light tasks               |

The shift from Opus-only (Apr 6) toward Sonnet+Opus 4.7 mix correlates with the declining cost/turn.

---

## Cache Analysis

### How Prompt Caching Works

Claude Code is stateless. Every turn, the full conversation — system prompt, tool schemas, all prior messages, your new message — is sent to the API from scratch. Anthropic's prompt cache keeps a copy of the prefix; if it hasn't changed and hasn't expired, subsequent turns read from cache at a fraction of the cost instead of re-processing everything.

- **Cache read**: $0.50/MTok (Opus) — context already in cache, cheap
- **Cache creation**: $6.25/MTok (Opus) — writing new cache entries, 12.5x the read price
- **Cache TTL**: Claude Code uses **both 5-minute and 1-hour cache tiers**. See below.

### Cache TTL: It's Both 5-Minute and 1-Hour

The JSONL `cache_creation` field breaks down into `ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens`. Across all sessions:

| Tier         | Tokens Created | Share |
| ------------ | --------------:| -----:|
| 5-minute TTL | 28,209,768     | 52.8% |
| 1-hour TTL   | 25,250,263     | 47.2% |

Claude Code uses **two cache tiers simultaneously**. Roughly half the cache is written at 5-minute TTL (likely the dynamic, turn-specific portion — tool outputs, recent messages) and half at 1-hour TTL (likely the stable prefix — system prompt, tool schemas, CLAUDE.md, early conversation).

Empirical verification — average cache read ratio by idle gap before the turn:

| Gap Duration | Turns  | Avg Cache % | Verdict                             |
| ------------ | ------:| -----------:| ----------------------------------- |
| 0–1 min      | 15,146 | 96.3%       | Cache alive                         |
| 1–5 min      | 1,136  | 96.0%       | Cache alive                         |
| 5–10 min     | 175    | 85.2%       | 5-min tier expired, 1-hr tier alive |
| 10–30 min    | 85     | 83.0%       | Same — partial survival             |
| 30–60 min    | 20     | 79.5%       | 1-hr tier still mostly alive        |
| 60–90 min    | 11     | 12.2%       | Both tiers expired                  |
| 90+ min      | 33     | 14.1%       | Both tiers expired                  |

**Longest gap with cache survival (>90%): 57.8 minutes.** After ~60 minutes, both tiers expire and the full context is re-created from scratch.

The Reddit poster's assumption of a uniform 5-minute TTL is wrong. The 1-hour tier means gaps of 5–60 minutes only lose the dynamic portion of cache (~50%), not everything. This is why only 2% of turns in this dataset show as full cache misses despite normal work breaks.

### Cache Efficiency

Overall cache read ratio: **95.5%**. This is strong — 95.5% of input tokens were served from cache at the cheap rate. For comparison, the Reddit benchmark reported 54% of turns following 5+ minute idle gaps. Only 2% of turns in this dataset followed idle gaps that long.

However, 95.5% still means 4.5% of input tokens hit the expensive path. On 2+ billion total input tokens, that 4.5% is substantial.

### Cache Cliffs

A **cache cliff** is a turn where the cache read ratio drops more than 40 percentage points — from near-100% cached to near-0%, forcing the entire context to be re-created at 12.5x the read rate.

**98 cache cliffs** detected in the API period. Distribution by idle gap before the cliff:

| Gap Before Cliff | Count | Notes                                            |
| ---------------- | -----:| ------------------------------------------------ |
| < 1 minute       | 29    | Not idle-related — context changed significantly |
| 1–5 minutes      | 18    | Within cache TTL; likely large tool outputs      |
| 5–15 minutes     | 36    | The "coffee break" zone                          |
| 15–60 minutes    | 9     | Still within 1-hour TTL but context diverged     |
| 1–4 hours        | 4     | Cache expired                                    |
| 4+ hours         | 2     | Session resumed after long break                 |

The largest category (36 cliffs in the 5–15 min range) suggests that while the 1-hour TTL helps, **context changes from tool outputs and edits** cause more cache invalidation than idle expiry alone. The 29 cliffs under 1 minute confirm this — those are pure context-change cliffs, not timeout cliffs.

Total cache-creation tokens on cliff turns: **8.1M tokens** (~$31 calibrated). This is the direct avoidable cost from cache cliffs.

### Worst Cache Cliffs

The top cliffs all occurred in the `ai-services-poc-1` marathon session on April 6:

| Cache Ratio Drop | Context Size | Gap    | Turn    |
| ---------------- | ------------:| ------ | ------- |
| 100% → 2%        | 513K tokens  | 9 min  | 836/868 |
| 100% → 2%        | 501K tokens  | 11 min | 808/868 |
| 100% → 2%        | 498K tokens  | 6 min  | 798/868 |
| 100% → 2%        | 491K tokens  | 6 min  | 781/868 |
| 100% → 2%        | 457K tokens  | 14 min | 657/868 |

These are 400K–500K token contexts being fully re-created. At those context sizes, a single cache cliff costs ~$2 per occurrence.

---

## Most Expensive Sessions

| Session  | Project                       | Turns | Duration | Cache % | Est. Cost |
| -------- | ----------------------------- | -----:| --------:| -------:| ---------:|
| 0753baf4 | ai-services-poc-1             | 397   | 5.1h     | 96%     | $80.50    |
| 93d7f3b8 | ai-services-poc-1             | 453   | 4.2h     | 96%     | $26.74    |
| 70d49ae2 | ai-services-poc-1             | 504   | 1.3h     | 99%     | $26.28    |
| 99ab8341 | claude-code-activity-analysis | 284   | 5.9h     | 95%     | $14.52    |
| d0c00a9f | ai-services-poc-1             | 277   | 2.8h     | 94%     | $13.57    |

Session `0753baf4` on April 6 is the outlier: $80.50 in a single 5-hour, 397-turn Opus session with 18 cache cliffs. This one session is **25% of the entire month's spend**.

---

## Usage Patterns

### Hourly Distribution (UTC → MDT: subtract 6)

Peak usage is 4pm–10pm MDT (22:00–04:00 UTC), consistent with afternoon/evening work sessions. The most expensive hour is 1pm MDT (19:00 UTC, $62.50 total) — likely the start of deep afternoon work sessions where context is large.

### Work Rhythm

- 16 active days out of 16 possible since API billing started
- Heaviest days (Apr 6, 17, 20) correlate with sustained multi-hour sessions on ai-services-poc-1
- Lightest days (Apr 13, 15) show exploratory/short sessions

---

## Comparison to Reddit Benchmark

A [Reddit analysis](https://www.reddit.com/r/ClaudeCode/) of 858 sessions over 33 days provides a useful comparison point.

| Metric                  | Reddit Poster       | This Audit                      |
| ----------------------- | ------------------- | ------------------------------- |
| Sessions                | 858                 | 126                             |
| Total turns             | 18,903              | 7,298                           |
| Avg turns/session       | 22                  | 58                              |
| Estimated spend         | $1,619 (33 days)    | $327 (16 days)                  |
| Turns after 5+ min idle | 54%                 | 2%                              |
| Cache cliffs            | 232                 | 98                              |
| Cache read ratio        | Not reported        | 95.5%                           |
| ENABLE_TOOL_SEARCH      | Off (before fix)    | On (built into version)         |
| Cache TTL observed      | 5 minutes (assumed) | Dual: 53% at 5-min, 47% at 1-hr |

**Key differences:**

1. **Session length**: 2.6x longer sessions here, meaning higher context sizes and more expensive individual cliffs — but far fewer sessions overall.
2. **Idle discipline**: Only 2% of turns follow 5+ min gaps vs 54%. Focused work bursts are the single biggest reason cache efficiency is higher here.
3. **Cache TTL**: The dual-tier cache (5-min + 1-hour) provides a buffer the Reddit poster doesn't account for. After a 5–30 min break, ~50% of context survives via the 1-hour tier. Full cache death requires 60+ minutes idle.
4. **Tool schema loading**: Already active via deferred `ToolSearch`, saving ~14K tokens/turn that the Reddit poster identified as his highest-leverage fix.

---

## Conclusions

### 1. Cache overhead is the dominant cost, not model intelligence

83% of spend ($273) goes to cache reads and creation. Only 16% ($53) pays for output. The stateless turn loop means you're renting the same context window over and over. Longer sessions with larger contexts amplify this linearly.

### 2. Context size × turn count is the cost formula

Cache reads are cheap per-token ($0.50/MTok) but you pay them **every turn** on the **entire context**. A 400-turn session with 450K average context pays for 180M cache-read tokens — $55 in cache reads alone from that single session. The most expensive session (`0753baf4`) spent $53 just on cache reads. Cutting it into 4 sessions of 100 turns at lower average context would have saved ~$31.

### 3. Cache cliffs are caused by context changes, not just idle time

47 of 98 cliffs (48%) occurred with gaps under 5 minutes — meaning the cache was still warm but the context had changed enough to force re-creation. The 22 "instant death" cliffs (under 1 minute) confirm that large tool outputs, file writes, and screenshots can invalidate the cache prefix even mid-conversation. Idle expiry is the minority cause.

### 4. The two-tier cache (5-min + 1-hour) provides more protection than assumed

After a 5–30 minute break, ~50% of context (the stable prefix) survives via the 1-hour cache tier. Full cache death only occurs after 60+ minutes. The "coffee break catastrophe" the Reddit poster describes is a half-problem here, not a full one.

### 5. Cost/turn has already improved 3.4x

From 8.9¢/turn on April 6 down to 2.6¢/turn on April 21, driven by shorter sessions and more Sonnet usage. Continuing this trend is the highest-leverage approach.

---

## Strategies to Reduce Token Usage

### Strategy 1: Cap Session Length (~$118 savings potential, 59% of cache read cost)

**The math:** If every session were capped at 100 turns, cache read cost drops from $200 to $81 — a $118 savings. This is because context grows monotonically within a session. By turn 200, you're paying for 150K+ tokens of cache reads per turn. By turn 400, it's 450K+ per turn. Starting fresh resets to ~25K.

**How to implement:**

- `/clear` and start a new session around turn 100–150, or when context feels heavy
- Use INTENT.md (already in your workflow) so the new session has full project context without carrying the raw conversation history
- The memory system auto-injects prior session context on startup, so continuity is preserved

**When NOT to do it:** Mid-flow on a complex multi-step task where losing tool output history would cause rework. In those cases, the cost of re-doing work exceeds the cache savings.

### Strategy 2: Use /compact Before Breaks (~$55 savings potential, 27% of cache read cost)

**The math:** If `/compact` reduced context to ~50K tokens every time it crossed 200K, the remaining turns in those sessions would read 50K instead of 200K–500K, saving ~$55.

**How to implement:**

- Run `/compact` before stepping away for any break (lunch, meeting, Slack thread)
- Run `/compact` when you notice context is large and the current task is winding down
- `/compact` preserves session state but summarizes older messages, so the context shrinks without losing continuity

**Trade-off:** Compaction loses detail from earlier turns. If you need to reference specific earlier tool output, it may be gone. For most workflows this is fine — you rarely need verbatim content from 100 turns ago.

### Strategy 3: Use Sonnet for Routine Work (ongoing, already improving)

**The math:** Sonnet cache reads cost $0.30/MTok vs Opus at $0.50/MTok — 40% cheaper for the same context. Output is $15/MTok vs $25/MTok. On a 100-turn session with 80K average context, that's $2.40 vs $4.00 in cache reads alone.

**How to implement:**

- Default to Sonnet (`/model sonnet`) for file edits, refactoring, test writing, straightforward implementation
- Switch to Opus (`/model opus`) for architectural decisions, complex debugging, multi-file reasoning
- Already trending this direction: Apr 21 shows a healthy Sonnet/Opus mix

### Strategy 4: Reduce Context-Change Cache Cliffs

48% of cache cliffs happen with <5 minute gaps, caused by context mutations, not idle time. The main triggers:

- **Large tool outputs**: A single Bash command returning 10K+ tokens of output shifts the context enough to invalidate the cache prefix
- **File writes/edits**: The Write tool result + file-history-snapshot changes the context structure
- **Screenshots**: Playwright screenshots inject large base64 payloads

**How to reduce:**

- Prefer targeted tool calls over broad ones (e.g., `Read` with line ranges instead of full files, `Grep` with `head_limit` instead of unlimited results)
- Avoid exploratory bash commands that dump large outputs mid-session (pipe to `head`, use `wc -l` to check size first)
- For Playwright workflows, minimize screenshot frequency — take them at decision points, not every step

### Strategy 5: Front-load Expensive Work

**The insight:** Early turns in a session are cheap (25K–50K context). Late turns are expensive (150K–500K context). The same tool call at turn 10 costs 3–10x less in cache reads than at turn 300.

**How to implement:**

- Do the heavy research/exploration at the start of a session when context is small
- Once you've narrowed down the approach, the implementation turns that follow will carry more context but each individual turn's contribution is smaller
- If you realize you need a new exploratory phase (different feature, different bug), that's a signal to `/clear` and start fresh rather than explore within a bloated session

### Strategy 6: Monitor and Set Guardrails

- Check the Enterprise usage dashboard weekly (you're at $327 of $600, on pace for ~$530)
- A single marathon day can consume 25%+ of the monthly budget (Apr 6 was $139)
- Set a mental daily cap (~$25/day leaves $10/day headroom for spike days)
- If a session reaches 200+ turns, that's a $10+ session — worth deciding if continuing or `/clear`-ing is more efficient

### Summary: Expected Impact

| Strategy                      | Potential Savings                      | Difficulty          |
| ----------------------------- | --------------------------------------:| ------------------- |
| Cap sessions at 100–150 turns | ~$118/month (59% of cache reads)       | Behavioral habit    |
| /compact before breaks        | ~$55/month (27% of cache reads)        | Easy, one command   |
| Sonnet for routine work       | ~$40–60/month                          | Already trending    |
| Reduce context-change cliffs  | ~$15–30/month                          | Requires awareness  |
| Front-load exploration        | Hard to quantify, compounds with above | Planning discipline |

These strategies compound. Shorter sessions mean smaller contexts, which mean cheaper cliffs, which mean less cache creation. The estimated combined impact is $150–250/month reduction from the current $327 baseline — potentially bringing monthly spend to $150–200 range.

---

## Data Sources

- **JSONL session files**: `~/.claude/projects/` — 126 sessions, 7,298 turns with usage data
- **Stats cache**: `~/.claude/stats-cache.json` — aggregate activity and model usage
- **Actual billing**: Anthropic Enterprise dashboard — $326.54 as of April 21, 2026
- **Calibration**: 0.61x correction factor derived from actual vs. published-rate estimates
- **Original analysis**: `claude_usage_ORIGINAL.html` — prior activity report (Jan 6–Apr 7)
