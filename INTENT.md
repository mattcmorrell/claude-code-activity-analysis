# Token Traction Slide Deck

## Goal
Build a ~10 minute video presentation for Matt's design team about Claude Code caching strategies and cost optimization. The core reframe: **"Token Traction" not "Token Efficiency."** Tokens are intelligence and work, not a scarce resource to minimize. The audience is designers already using Claude Code CLI at varying skill levels — they started on Max subscription plans, moved to Enterprise/API at work, and many still use Max at home.

## Key Messages (in playbook slide order)
1. Session length drives cost more than model choice
2. Keep deep sessions warm (5-min cache TTL)
3. Multi-claude smart: one deep, rest shallow
4. Use Opus instead of Sonnet
5. Use long-term memory files (CLAUDE.md, INTENT.md) to carry traction across sessions

## Technical Setup
- **Single self-contained HTML file**: `token-traction-deck.html`
- **No framework** — custom slide engine with CSS animations (~30 lines JS)
- **Dark theme** matching existing cost tool palette (bg: #0f1117, card: #181a24)
- **Fonts**: DM Sans (headings) + JetBrains Mono (code/numbers) via Google CDN
- **Navigation**: Arrow keys = whole slides, Click/Spacebar = step through animations within slides
- **Step-based animation system**: each slide has N internal "steps" triggered by clicks, CSS animations gated by `.slide-X.step-N` class selectors
- **Iframe embed**: `session-cost-comparison.html` loaded live on the cost comparison slide (slide 11)
- **15 slides** (was 17 originally, merged cache slides 6+7, merged traction cards from slide 3 into slide 2)

## Current Slide Order (15 slides)
1. **Title** — "Token Traction" with subtitle
2. **Reframe + Cards** — Efficiency vs Traction panels, then 3 traction cards animate in below (merged old slides 2+3). 4 steps.
3. **Playbook** — 5 numbered takeaways: Session length, Keep warm, Multi-claude, Opus over Sonnet, Memory files
4. **Caching** — Two-panel graphic: Max Plan (flat fee, caching invisible) vs Enterprise/API (pay per token, cache hits save money). Bar segments show cache read vs new tokens. Bridge: "making that green bar as big as possible"
5. **How Caching Works** — 8-step flow: 5 turns with growing horizontal bars showing cache ratio improvement → "Cache reads 10x cheaper than new tokens" stat → Turn 5 isolates → two tier bars (Base Layer + Conversation) appear underneath with visual mini-timelines showing TTL behavior
6. **Cache Sweet Spot** — Warmth gradient bar (green → yellow → red)
7. **Multi-Claude Strategy** — Terminal pane layout: one deep session, rest shallow
8. **Session Length** — Cumulative context growth visualization (turns stacking)
9. **Screenshots — The Hidden Weight** — Screenshots as permanent weight that never compresses
10. **Opus vs Sonnet** — Cost math comparison
11. **Live Cost Comparison** — Full-width iframe of `session-cost-comparison.html`
12. **/compact** — Surgical reduction visual (oldest dissolve, middle summarize, recent preserved, screenshots survive)
13. **/clear — Nuke** — Nuclear option visual. "Everything. Gone." in red. /clear nukes EVERYTHING including base layer.
14. **Long-Term Memory** — Files that survive /clear (INTENT.md, CLAUDE.md, knowledge.md)
15. **Closing** — "Think bigger. Use more tokens. Go further." with recap pills

## Current Direction
Iterating on individual slide visuals. The slide engine, navigation, and step-based click control are all working. Most recent work was on slide 5: replaced text-heavy tier TTL explanations with visual mini-timeline graphics showing turns, gaps, and cache persistence states.

## What's Done
- Full slide engine with click-controlled step animations (no auto-play)
- Arrow keys navigate slides, clicks/spacebar step through animations
- 15-slide structure with all content populated
- Slide 1: Fixed JS initialization so first slide is visible on load (opacity/transform)
- Slide 2: Merged old slide 3 traction cards underneath the efficiency/traction panels. Removed "Tokens are intelligence" line. 4 steps.
- Slide 3: Playbook reordered to match deck narrative (Opus moved to #4)
- Slide 4: Redesigned from "Two Worlds" to "Caching" — bar segment graphics showing cache visibility difference between Max and Enterprise plans. Deleted enterprise-at-work callout.
- Slide 5: Combined cache timeline + tier breakdown into one continuous 8-step flow
  - Steps 1-5: turns appear with growing bars showing cache ratio improvement
  - Step 6: "Cache reads 10x cheaper than new tokens" stat
  - Step 7: other turns fade, Turn 5 isolates with "What's in that cached portion?"
  - Step 8: two tier bars with visual mini-timelines underneath:
    - Base Layer: 5 green ticks with 20-min gap, continuous green persist bar = "cached the whole time"
    - Conversation: 5 ticks where last 2 turn red after 7-min gap, split bar (green→red) = "expired — cold re-read"
  - Tier labels: Base = "System prompt / Tools / CLAUDE.md" with "1-hour TTL", Conversation = "Your turns / Responses / Screenshots" with "5-min TTL"
- Slide 13: /clear nuke — changed survivor label to "Everything. Gone." in red, removed survivor-line element
- Slide 15: Closing pills reordered, "Opus 4.6 in CLI" → "Opus over Sonnet"
- Session cost comparison tool embedded as iframe on slide 11

## Rejected Approaches
- **reveal.js framework**: Too much fighting CSS specificity and layout opinions. Custom engine is ~30 lines of JS and gives full control.
- **Auto-playing animations with delays**: User needs click control to time animations with talk track. Replaced all `animation-delay` auto-play with step-gated triggers.
- **Separate slides for cache timeline and tier breakdown**: Merging into one slide gives a smooth continuous flow from growing bars → zoom into cache → tier reveal.
- **Card-style tier blocks**: Too large, didn't visually connect to the green cached bar above. Switched to proportionally-scaled bar segments directly underneath with labels below.
- **Blue/orange tier colors**: Confusing — tiers are both parts of the green "cached" segment, so both should be green (different shades).
- **"Base layer survives /clear"**: Incorrect — /clear nukes everything including the base layer. It's a full cold restart. Fixed on slide 5 insight and slide 13 nuke visual.
- **Text-heavy tier explanations on slide 5**: Paragraphs explaining TTL behavior were too text-heavy. Replaced with visual mini-timeline graphics showing turns, gaps, and persist bars.
- **Enterprise callout on slide 4**: "Use Enterprise at work" messaging removed — slide now focuses purely on cache economics.

## Open Questions
- Does the tier visual mini-timelines on slide 5 communicate clearly? (Not yet verified in browser)
- Slide 8 (session length) and slide 5 both show cumulative context growth — is there too much overlap? Different enough (cache vs. cost framing)?
- Does the multi-claude slide (7) need a more concrete visual?

## Next Steps
- Verify tier visual mini-timelines look correct in browser
- Continue reviewing each slide's visual quality and animation timing
- Test full run-through for ~10 minute pacing
- Record the video presentation
