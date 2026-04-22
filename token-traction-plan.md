# Token Traction Slide Deck — Implementation Plan

## Context
Matt wants a ~10 minute video presentation for his design team about Claude Code caching strategies and cost optimization. The core reframe: "Token Traction" not "Token Efficiency." The audience is designers already using Claude Code CLI at varying skill levels. One existing asset — `session-cost-comparison.html` — will be embedded live as an interactive iframe.

## Technical Approach
- **Single self-contained HTML file** (`token-traction-deck.html`)
- **No framework** — custom slide engine (~30 lines JS for navigation + transitions)
- **Dark theme** matching existing cost tool palette
  - BG: `#0f1117`, Cards: `#181a24`, Text: `#e8eaed`
  - Sonnet: `#e8784e`, Opus 4.6: `#5b9cf5`, Opus 4.7: `#b07df0`, Haiku: `#4ecb8d`
- **Fonts**: DM Sans (headings/body) + JetBrains Mono (code/numbers) via Google Fonts CDN
- **Navigation**: Arrow keys, click, number keys for direct jump
- **Transitions**: CSS slide/fade animations on class toggle
- **Animated visuals**: CSS keyframe animations triggered on slide enter
- **Slide counter**: subtle bottom-right indicator
- **Iframe embed**: `session-cost-comparison.html` loaded in an iframe on the cost comparison slide

## Audience Context
Designers who started on Max subscription plans, moved to Enterprise/API at work, and many still use Max at home. They need to understand that the economics are fundamentally different now — Max is a flat fee with rate limits, Enterprise/API is pay-per-token. The caching strategies matter because the meter is running.

## Slide-by-Slide Structure (~17 slides, 10 min)

### Slide 1: Title
- **"Token Traction"** large, bold
- Subtitle: "How to go further with Claude Code"
- Simple animated element: subtle particle/pulse animation behind title

### Slide 2: The Reframe — Traction, Not Efficiency
- Left side: **"Efficiency"** with a gas gauge running low, scarcity imagery — dim/red tones
- Right side: **"Traction"** with wheels gripping road, power transfer imagery — bright/blue tones
- On-screen: "Tokens are intelligence. Go further, not fewer."
- CSS animation: the two sides slide in from opposite edges

### Slide 3: What Token Traction Means
- 3 animated cards that pop in sequentially:
  1. "Use MORE tokens" — not fewer
  2. "Maximize GRIP" — every token drives forward progress
  3. "Go FURTHER" — bigger ambitions, deeper work
- On-screen: "Remove friction. Not tokens."

### Slide 4: The Takeaways (upfront)
- Clean numbered list, items animate in one by one:
  1. Use Opus 4.6 in CLI — it pays for itself
  2. Session length drives cost more than model choice
  3. Keep deep sessions warm
  4. Multi-claude smart: one deep, rest shallow
  5. Use long-term memory files to go further across sessions
- "Let's look at why."

### Slide 5: Max vs Enterprise — Why This Matters Now
- **Two-panel comparison**, animated side by side:
  - **Left: Max Plan** — flat line visual with a wall (rate limit). Label: "Ceiling, not a bill"
  - **Right: Enterprise / API** — rising diagonal, no ceiling. Label: "Meter, not a wall"
- **Bridge**: "Go further on both."
- **"Why not personal plan at work?"** callout (animates in after panels):
  - On-screen: "Your usage shapes the team's allocation. We need the signal."
  - Talking point: we're still calibrating token budgets after the API transition — if everyone stays on personal plans, we lock in a bad number
- CSS animation: left panel fades in first (familiar), right panel slides in, then callout rises from bottom

### Slide 6: How Caching Works — The Big Picture
- **Animated timeline diagram**:
  - Visual: horizontal timeline showing a 5-minute window
  - Turn 1: tokens write to cache (blue fill animation)
  - Turn 2 (within 5 min): tokens read from cache (green/fast), only new tokens write (blue)
  - Turn 3 (after 5 min gap): cache expired, everything re-writes (red flash, then blue fill)
- Key stat on-screen: "Cache reads = 10× cheaper"
- Cache block pulses at end, hinting there's more to see...

### Slide 7: Two Cache Tiers — Zooming In
- **Visual concept**: The cache block from slide 6 "zooms in" and splits into two layers
  - CSS animation: a single rounded rect expands and divides into top/bottom halves
- **Top layer: "Base Layer" — 1 hr** (cool blue, steady pulse)
  - Labels: "System prompt · Tools · CLAUDE.md" — "1-hour TTL"
- **Bottom layer: "Conversation" — 5 min** (warm orange, grows, flickers if idle)
  - Labels: "Your turns · Responses · Growing" — "5-minute TTL"
- On-screen insight: "/clear kills the conversation. The base layer survives."

### Slide 8: Why Session Length Is the #1 Cost Driver
- **Animated stacking visual**: 
  - Shows turns stacking up, each turn re-sends ALL previous context
  - Turn 1: small bar. Turn 5: medium bar. Turn 15: massive bar.
  - The "cumulative re-read" is the key visual — each turn's bar includes all previous context
- On-screen: "Turn 15 re-reads turns 1–14. That's the cost."

### Slide 9: Screenshots — The Hidden Weight
- **Visual concept**: A conversation shown as stacked blocks (like slide 8). Text blocks are light/compressible. Then screenshot blocks drop in — heavy, dense, glowing orange/red, visually "heavier" than text blocks.
- Labels on blocks: "~2,300 tokens" / "~3,700 on 4.7"
- Compaction animation: text blocks shrink, screenshot blocks don't budge
- On-screen: "Screenshots never compress. Permanent weight."
- CSS animation: blocks stacking, compaction sweep, screenshots stubbornly remain

### Slide 10: The Cache Sweet Spot
- Visual: warmth gradient bar — green → yellow → red
  - Green: "Steady turns" / Yellow: "> 5 min gap" / Red: "Cold start"
- On-screen: "Deep session? Keep it moving."

### Slide 11: Opus vs Sonnet — The Math
- Simple animated comparison:
  - Sonnet: 1.0x per token, but needs 2-3x more turns → show turns multiplying
  - Opus: 1.67x per token, but gets it right → show clean completion
  - Animated "total cost" bars that grow to show Opus wins when Sonnet > 2x turns
- Transition text: "Let's see this live..."

### Slide 12: Live Cost Comparison (IFRAME)
- **Full-width iframe** embedding `session-cost-comparison.html`
- Minimal chrome — just the iframe with a thin border
- Presenter can interact with sliders live during the video
- Small instruction text at bottom: "Drag sliders to explore"

### Slide 13: Multi-Claude Strategy
- Visual: terminal pane layout diagram (CSS grid mock)
  - One large pane labeled "Deep Session" (glowing blue border, pulsing)
  - 2-3 smaller panes labeled "Shallow" (dim borders)
- Labels animate in:
  - "Shallow = cheap misses ✓"
  - "Multiple deep = expensive misses ✗"
  - "Prioritize the deep session."

### Slide 14: /compact — Surgical Reduction
- **Visual**: A conversation shown as ~10 stacked blocks (turns), color-coded by age:
  - **Oldest (top 3-4)**: dark/dim blocks → animated: they dissolve/fade out completely. Label: "Oldest context — removed"
  - **Middle (3-4 blocks)**: medium blocks → animated: they physically shrink, text inside blurs and is replaced by a smaller summary block. Label: "Summarized — rewritten shorter"
  - **Recent (2-3)**: bright blocks → animated: they stay exactly as-is, maybe glow slightly. Label: "Recent context — preserved"
  - **Screenshot blocks** (scattered through): heavy orange blocks → animated: they DON'T shrink. They survive compaction at full size, stubbornly sitting there. Callback to slide 9.
- After animation: stack visibly shorter, screenshots unchanged
- On-screen: "/compact — keeps direction, sheds weight"

### Slide 15: /clear — ☢️ Nuclear Option
- **Visual**: Same conversation stack from previous slide, but this time:
  - A ☢️ nuclear symbol drops in from above (CSS animation: falls, impacts, shockwave)
  - ALL blocks — text, screenshots, everything — vaporize outward in a blast animation
  - Screen goes momentarily bright, then fades to empty black
  - A single thin line appears: the base layer (system prompt, CLAUDE.md) — the only survivor
  - Label: "Base layer survives. Everything else: gone."
- Then: fresh clean blocks start appearing
- On-screen: "/clear — scorched earth, fresh traction"
- Small guide at bottom: "/compact = still relevant, too long" · "/clear = new direction"

### Slide 16: Long-Term Memory — Go Further Across Sessions
- Visual: files floating/arranging into a stack
  - `INTENT.md` — "What we're building and why"
  - `CLAUDE.md` — "Project rules and patterns"  
  - `knowledge.md` — "Domain context that survives /clear"
- On-screen: "Traction that survives /clear"

### Slide 17: Closing — Go Further
- Return to the traction metaphor
- Bold text: "Think bigger. Use more tokens. Go further."
- Recap the 5 takeaways as small text below
- Animated callback to the traction visual from slide 2

## Navigation & Controls
- **Arrow keys** (left/right): prev/next slide
- **Number keys**: jump to slide N
- **Click**: next slide
- **Escape**: show slide overview (optional, nice-to-have)
- Slide counter in bottom-right corner
- Progress bar at top (thin line)

## Animations Approach
- Each slide has an `.active` class toggled by JS
- Slide transitions: `transform: translateX()` with `transition: 0.5s ease`
- On-slide animations: CSS `@keyframes` triggered by `.active` class
- Staggered item entrance: `animation-delay` on child elements
- Keep animations purposeful — they illustrate concepts, not just decorate

## File to create
- `/Users/mmorrell/CascadeProjects/claude-code-activity-analysis/token-traction-deck.html`

## File to reference (iframe source)
- `/Users/mmorrell/CascadeProjects/claude-code-activity-analysis/session-cost-comparison.html`

## Verification
1. Open `token-traction-deck.html` in browser
2. Arrow keys navigate between all 17 slides
3. Each slide's animations trigger on entry
4. Slide 12 iframe loads the cost comparison tool and sliders are interactive
5. All text meets contrast/size requirements (no text below 13px body / 11px labels, no text dimmer than #999)
6. Smooth transitions, no jank
