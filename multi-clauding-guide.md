# Multi-Clauding: What Actually Works (and What Bleeds Money)

> **Note:** This analysis was conducted using Opus 4.6 session data. Opus 4.7 figures are derived from published tokenizer benchmarks (~30% inflation) applied to the same workload.

## How the Cache Works

Claude Code is stateless — every turn re-sends your entire conversation to the API. Anthropic caches this so you're not paying full price every time. But the cache has **two expiry tiers**:

- **5-minute tier** (~53% of context): recent messages, tool outputs, dynamic content
- **1-hour tier** (~47% of context): system prompt, tool schemas, CLAUDE.md, early conversation

When you're working in one Claude instance, the others are idling. After 5 minutes idle, an instance loses half its cache. After 60 minutes, it loses everything. Each time you switch back, you pay a re-creation penalty proportional to context size.

## The Expensive Pattern

Multiple Claude Code instances all running deep sessions (200+ turns). You rotate between them, spending 8–10 minutes in each. Every switch-back triggers a cache re-creation penalty. Over a full day, this adds $15–$22 in pure switching tax on Opus 4.6 — money spent rebuilding cache, not getting work done.

## What to Do Instead

**Use subagents for parallelism, not separate instances.** Subagents (the `Agent` tool, background tasks) run inside the parent session's cache. No idle decay, no switching penalty. This is the intended pattern for parallel work.

**One deep session at a time.** If you need focused multi-hundred-turn work, do it sequentially. `/compact` or `/clear` before switching projects. The context reset is cheap; the idle cache decay is not.

**Short parallel sessions are fine.** Small-context instances (under 50 turns, different projects) have low re-creation costs. The problem is specifically multiple *large* contexts idling simultaneously.

**Stay under 5 minutes if you do rotate.** If you're working across 2–3 instances, keep your rotation under ~4 minutes per instance so nothing expires. This is fragile in practice — one deep debug and the timer breaks.

**`/compact` before stepping away.** If you know you're about to switch to another instance for a while, `/compact` first. A 50K context re-creation costs 4–10x less than a 300K one.

## Quick Reference

| Pattern                                   | Cache Cost                          | Verdict                |
| ----------------------------------------- | ----------------------------------- | ---------------------- |
| 1 deep session + subagents                | Optimal                             | Best for parallel work |
| 2–3 short independent sessions            | Low                                 | Fine                   |
| Rotating between 2–3 deep sessions        | High ($15–22/day extra on Opus 4.6) | Avoid                  |
| Leaving 3+ deep sessions idle for 60+ min | Very high (full re-creation on all) | Never do this          |

## Cache Costs by Model

Sonnet 4.6 and Opus 4.6 share the same tokenizer — the only difference is per-token price (1.67x). Opus 4.7 has the same per-token price as Opus 4.6, but its **new tokenizer inflates token counts by ~30%** for the same text, making it effectively ~2.17x the cost of Sonnet per turn.

### Per-Token Rates ($/MTok)

|                      | Sonnet 4.6 | Opus 4.6 | Opus 4.7 |
| -------------------- | ----------:| --------:| --------:|
| Input (uncached)     | $3.00      | $5.00    | $5.00    |
| Cache read           | $0.30      | $0.50    | $0.50    |
| Cache write (5-min)  | $3.75      | $6.25    | $6.25    |
| Cache write (1-hour) | $6.00      | $10.00   | $10.00   |
| Output               | $15.00     | $25.00   | $25.00   |

### Effective Cost Multiplier vs. Sonnet 4.6

|                             | Sonnet 4.6 | Opus 4.6              | Opus 4.7              |
| --------------------------- | ----------:| ---------------------:| ---------------------:|
| Price multiplier            | 1.0x       | 1.67x                 | 1.67x                 |
| Tokenizer multiplier        | 1.0x       | 1.0x (same tokenizer) | ~1.3x (new tokenizer) |
| **Effective cost per turn** | **1.0x**   | **1.67x**             | **~2.17x**            |

### Per-Turn Cost Comparison (200K content-equivalent context)

|                                                     | Sonnet 4.6 | Opus 4.6 | Opus 4.7     |
| --------------------------------------------------- | ----------:| --------:| ------------:|
| Tokens for same content                             | 200K       | 200K     | ~260K (+30%) |
| Cache read cost per turn                            | $0.06      | $0.10    | $0.13        |
| Cache cliff re-creation (5-min tier, ~100K content) | $0.38      | $0.63    | $0.81        |
| Cache cliff re-creation (full, ~200K content)       | $0.75      | $1.25    | $1.63        |

### What This Means for Multi-Clauding

The switching tax scales with both model cost and tokenizer efficiency:

| Scenario: 3 deep sessions, 10 cache cliffs/day  | Sonnet 4.6 | Opus 4.6 | Opus 4.7 |
| ----------------------------------------------- | ----------:| --------:| --------:|
| Daily switching tax (partial cliffs)            | ~$3.80     | ~$6.30   | ~$8.10   |
| Daily switching tax (full cliffs, 60+ min idle) | ~$7.50     | ~$12.50  | ~$16.30  |

Opus 4.7 is **~2.1x** the switching cost of Sonnet 4.6 for identical work — the 1.67x price ratio compounded by the 1.3x tokenizer inflation.

## The Real Model Choice: Cost per Turn vs. Cost per Task

Per-token pricing makes Sonnet 4.6 look 1.67x cheaper than Opus 4.6 (and 2.17x cheaper than Opus 4.7). But **cost per turn is the wrong metric — cost per task is what matters.** If a cheaper model breaks things and requires fix-up turns, the per-token savings are wiped out by context bloat.

### Why Sonnet's price advantage is misleading

If Sonnet breaks things and requires fix-up turns, every fix-up turn does two things:

1. **Costs money now** — cache reads on the current context
2. **Makes every future turn more expensive** — adds to context that all subsequent turns pay for

That second effect is the killer. It's not a one-time penalty — it's a permanent tax on every remaining turn in the session.

### Worked example: same task, three models

Assumptions: task starts at 50K context (Sonnet/Opus 4.6 tokens), each turn adds ~5K tokens, fix-up turns add ~6K (error messages, re-reads, tool outputs are slightly larger). Opus one-shots the task in 5 turns. Sonnet takes 15 turns (5 productive + 10 fixing).

|                      | Opus 4.6 (5 turns) | Opus 4.7 (5 turns) | Sonnet 4.6 (15 turns)         |
| -------------------- | ------------------:| ------------------:| -----------------------------:|
| Turns to complete    | 5                  | 5                  | 15 (5 productive + 10 fixing) |
| Avg context (tokens) | ~60K               | ~78K (60K × 1.3)   | ~89K (bloated by fix-ups)     |
| Cache reads total    | $0.15              | $0.20              | $0.40                         |
| Output total         | $0.25              | $0.33              | $0.45                         |
| **Cost for task**    | **~$0.40**         | **~$0.53**         | **~$0.85**                    |

Sonnet costs **2.1x more than Opus 4.6** and **1.6x more than Opus 4.7** to complete the same task — despite being the cheapest model per token.

### Break-even points: when does Opus pay for itself?

The break-even depends on which Opus you're comparing. Opus 4.6 has a lower bar to clear because it shares Sonnet's tokenizer. Opus 4.7's tokenizer inflation raises the threshold.

|                         | Opus 4.6 vs. Sonnet 4.6          | Opus 4.7 vs. Sonnet 4.6        |
| ----------------------- | -------------------------------- | ------------------------------ |
| Effective cost per turn | 1.67x Sonnet                     | 2.17x Sonnet                   |
| **Break-even**          | **Sonnet takes ~1.5x the turns** | **Sonnet takes ~2x the turns** |
| At 2x Sonnet turns      | Opus 4.6 saves ~23%              | Roughly equal                  |
| At 3x Sonnet turns      | Opus 4.6 saves ~53%              | Opus 4.7 saves ~39%            |

**How to read this:** If Sonnet routinely needs 3 attempts to get something right that Opus 4.6 one-shots, Opus 4.6 costs half as much for the same work. Even Opus 4.7 — with its 30% tokenizer tax — saves ~39% at that ratio.

The critical question for Opus 4.7 specifically: **does it one-shot things that Opus 4.6 also needs multiple attempts for?** If yes, the tokenizer tax pays for itself. If Opus 4.6 and 4.7 have similar one-shot rates on your work, Opus 4.6 is strictly cheaper.

### It gets worse over time, not better

There is **no inflection point where Sonnet catches back up** in a long session. The advantage of either Opus model compounds:

| Session phase | Opus 4.6/4.7 (one-shots) | Sonnet 4.6 (3x turns)      | Dynamic                                                        |
| ------------- | ------------------------ | -------------------------- | -------------------------------------------------------------- |
| Turns 1–20    | Slightly more per turn   | Slightly cheaper per turn  | Small context, Sonnet's price edge visible                     |
| Turns 20–80   | Cheaper overall          | Fix-up bloat accumulating  | Sonnet paying cache reads on its own error history             |
| Turns 80–200  | Much cheaper             | Context snowballing        | Every fix adds permanent weight to every future turn           |
| Turns 200+    | Dramatically cheaper     | Approaching context limits | Compaction needed sooner, losing detail, causing more breakage |

The **compaction death spiral** is the endgame: Sonnet hits the context wall earlier because of bloat → compaction loses detail → lost detail causes more mistakes → more fix-up turns → more bloat. The session becomes unrecoverable without `/clear`.

Opus 4.7 hits context limits ~23% sooner than Opus 4.6 due to the tokenizer inflation (same content = 30% more tokens = less room before compaction). This partially offsets its capability advantage in very long sessions. Opus 4.6 has the most headroom.

### When Sonnet genuinely saves money

Sonnet wins on tasks it can **reliably one-shot**:

- Simple file edits, renames, moves
- Straightforward refactoring with clear patterns
- Test writing from existing examples
- Short sessions where context bloat can't compound
- Tasks where a mistake is immediately obvious and fixable in one correction

### When Opus 4.6 pays for itself

- Multi-file changes where getting it wrong cascades
- Complex debugging requiring multi-step reasoning
- Architectural work where a wrong approach wastes 20+ turns before you realize it
- Deep sessions (100+ turns) where context bloat compounds
- Any task where you'd need to re-explain the full situation after breakage
- **Best cost/capability ratio**: same tokenizer as Sonnet, so no inflation penalty. Only 1.67x per turn, breaks even if Sonnet needs just 1.5x the attempts.

### When Opus 4.7 is worth the premium

- Problems that Opus 4.6 also struggles with (not just Sonnet)
- Tasks where the improved reasoning produces measurably better first-attempt results
- Short, targeted sessions where the tokenizer tax doesn't compound over many turns
- **Not worth it** if Opus 4.6 would also one-shot the task — you're paying 30% more for the same outcome

### The argument to make

"Sonnet is cheaper" is a per-token claim. **"Opus is cheaper" is a per-task claim.**

For non-trivial engineering work — the kind where mistakes cascade, context matters, and you can't just `/clear` and start over — the model that gets it right the first time costs less than the model that's cheaper per token but takes three attempts.

The data supports this: cost/turn dropped from 8.9c to 2.6c not primarily from switching to cheaper models, but from shorter sessions with less rework. **Getting it right the first time is the highest-leverage cost optimization.**

The specific model recommendation depends on the task:

| Task Complexity                            | Best Model | Why                                                                    |
| ------------------------------------------ | ---------- | ---------------------------------------------------------------------- |
| One-shottable (simple edits, refactors)    | Sonnet 4.6 | Cheapest per token, no fix-up risk                                     |
| Non-trivial engineering work               | Opus 4.6   | 1.5x break-even is easy to clear; same tokenizer as Sonnet             |
| Hardest problems (Opus 4.6 also struggles) | Opus 4.7   | 2x break-even is higher bar, but worth it if 4.6 can't one-shot either |

## The Screenshot Tax

A common workflow — "fix this ___" + screenshot — introduces a hidden cost multiplier that compounds with everything above.

### How screenshots are tokenized

Screenshots are sent as base64-encoded images and converted to tokens based on pixel dimensions: **width × height ÷ 750**. Claude auto-resizes images to a max long edge of ~1568px before tokenization.

| Screenshot Type          | Resolution After Resize | Tokens |
| ------------------------ | ----------------------- | ------:|
| Full-screen (1920×1080)  | ~1568×882               | ~1,844 |
| Laptop screen (1440×900) | 1440×900                | ~1,728 |
| Cropped region (800×600) | 800×600                 | ~640   |
| Small element (400×300)  | 400×300                 | ~160   |

Image tokens are priced the same as text input tokens. They participate in prompt caching. The Opus 4.7 tokenizer inflation does **not** apply to images — they're tokenized by pixel count, not by the text tokenizer.

### The problem: screenshots are permanent, incompressible context

Text context can be compacted — `/compact` summarizes older messages and shrinks the context. **Screenshots cannot be compacted.** They persist as-is in the conversation history. Every turn after you paste a screenshot, you pay cache reads on those ~1,800 tokens forever.

This makes screenshots fundamentally different from other context bloat:

| Context type    | Can be compacted? | Persists until         |
| --------------- | ----------------- | ---------------------- |
| Text messages   | Yes               | `/compact` or `/clear` |
| Tool outputs    | Yes               | `/compact` or `/clear` |
| **Screenshots** | **No**            | **`/clear` only**      |

### Cost of screenshots over a session

One screenshot (~1,800 tokens) doesn't look expensive. But it's not a one-time cost — it's a per-turn tax for the rest of the session.

**One screenshot, carried for N turns:**

| Remaining turns | Sonnet 4.6 | Opus 4.6 | Opus 4.7 |
| --------------- | ----------:| --------:| --------:|
| 10 turns        | $0.005     | $0.009   | $0.009   |
| 50 turns        | $0.027     | $0.045   | $0.045   |
| 100 turns       | $0.054     | $0.090   | $0.090   |
| 200 turns       | $0.108     | $0.180   | $0.180   |

Looks small. Now consider a realistic "fix this" workflow:

### The "fix this + screenshot" workflow multiplier

A typical debugging session might include 5–10 screenshots: the initial bug, the state after each fix attempt, a comparison view, the final result. If Sonnet needs fix-up turns, **each fix attempt adds another screenshot exchange** — you screenshot the broken result, paste it, Sonnet tries again.

**10 screenshots across a 100-turn session (~18K tokens of permanent image context):**

|                                                          | Sonnet 4.6 | Opus 4.6   | Opus 4.7   |
| -------------------------------------------------------- | ----------:| ----------:| ----------:|
| Cache reads on screenshot context (100 turns)            | $0.54      | $0.90      | $0.90      |
| Cache cliff re-creation (screenshots portion, per cliff) | $0.11      | $0.11      | $0.11      |
| 5 cache cliffs on screenshots                            | $0.56      | $0.56      | $0.56      |
| **Total screenshot tax for session**                     | **~$1.10** | **~$1.46** | **~$1.46** |

But here's where model choice intersects: **Sonnet's fix-up loops generate more screenshots.**

### Screenshots × fix-up turns: the compounding effect

If Opus 4.6 one-shots a visual fix in 3 turns (look at screenshot → fix → done), and Sonnet takes 9 turns (look → fix → broke something → screenshot → fix → still wrong → screenshot → fix → done), the screenshot count roughly tracks the turn ratio:

|                                                 | Opus 4.6 (3 turns, 2 screenshots) | Sonnet 4.6 (9 turns, 5 screenshots) |
| ----------------------------------------------- | ---------------------------------:| -----------------------------------:|
| Screenshot tokens                               | ~3,600                            | ~9,000                              |
| Cache reads on screenshots (50 remaining turns) | $0.09                             | $0.14                               |
| Cache reads on full context (50 turns)          | $0.75                             | $1.68                               |
| Output                                          | $0.15                             | $0.27                               |
| **Task total**                                  | **~$0.99**                        | **~$2.09**                          |

Sonnet costs **2.1x more** — and the gap is wider than the text-only analysis because screenshots add incompressible bulk that accelerates context growth.

### Strategies to reduce screenshot cost

**Crop before pasting.** A cropped 800×600 region is ~640 tokens. A full-screen 1920×1080 is ~1,844 tokens. Cropping to just the relevant UI element saves ~65% of the image tokens — compounded across every remaining turn.

**One screenshot per fix, not progress screenshots.** Only paste a new screenshot when the model needs to see something it can't infer from code. "It's still broken" + screenshot is necessary. "Here's what it looks like now" when it's working is pure cost.

**`/clear` after visual debugging.** Screenshot-heavy sessions bloat context faster than text-only sessions, and that context can't be compacted. Once the fix is confirmed, `/clear` and start fresh.

**Describe instead of screenshot when possible.** "The button is misaligned 10px to the left" is ~15 tokens. A screenshot proving it is ~1,800 tokens — 120x more. If the description is unambiguous, skip the screenshot.

| Strategy                        | Token savings per screenshot       | Effort                |
| ------------------------------- | ----------------------------------:| --------------------- |
| Crop to relevant region         | ~1,200 tokens (65%)                | Low — one extra step  |
| Skip confirmation screenshots   | ~1,800 tokens (100%)               | Behavioral habit      |
| `/clear` after visual debugging | Resets all accumulated screenshots | Easy                  |
| Describe instead of screenshot  | ~1,785 tokens (99%)                | Only when unambiguous |

## TL;DR

The cache rewards focus. One deep session with subagents > multiple deep sessions you rotate between. If you're paying for Claude Code API, the way you split your attention across instances directly affects your bill.

On model choice: **cost per token is misleading — cost per task is what matters.** Opus 4.6 pays for itself the moment Sonnet needs 1.5x the turns — a low bar for real engineering work. Opus 4.7 pays for itself at 2x turns, but its 30% tokenizer inflation means it should be reserved for problems that Opus 4.6 also can't one-shot. The model that gets it right the first time avoids the context bloat, fix-up loops, and compaction death spirals that make "cheaper per token" models more expensive in practice.

On screenshots: they're **permanent, incompressible context** — ~1,800 tokens each that can't be compacted away. In fix-up workflows, Sonnet's extra attempts generate more screenshots, which bloat context faster, which makes every subsequent turn more expensive. Crop to the relevant region, skip confirmation screenshots, and `/clear` after visual debugging sessions.
