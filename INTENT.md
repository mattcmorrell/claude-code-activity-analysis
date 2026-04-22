# Token Traction Slide Deck

## Goal
Build a ~10 minute video presentation for Matt's design team about Claude Code caching strategies and cost optimization. The core reframe: **"Token Traction" not "Token Efficiency."** Tokens are intelligence and work, not a scarce resource to minimize. The audience is designers already using Claude Code CLI at varying skill levels — they started on Max subscription plans, moved to Enterprise/API at work, and many still use Max at home.

## Key Messages
1. Use Opus 4.6 in CLI — it pays for itself
2. Session length drives cost more than model choice
3. Keep deep sessions warm (5-min cache TTL)
4. Multi-claude smart: one deep, rest shallow
5. Use long-term memory files (CLAUDE.md, INTENT.md) to carry traction across sessions

## Technical Setup
- **Single self-contained HTML file**: `token-traction-deck.html`
- **No framework** — custom slide engine with CSS animations
- **Dark theme** matching existing cost tool palette (bg: #0f1117, card: #181a24)
- **Fonts**: DM Sans (headings) + JetBrains Mono (code/numbers) via Google CDN
- **Navigation**: Arrow keys = whole slides, Click/Spacebar = step through animations within slides
- **Step-based animation system**: each slide has N internal "steps" triggered by clicks, CSS animations gated by `.slide-X.step-N` class selectors
- **Iframe embed**: `session-cost-comparison.html` loaded live on the cost comparison slide
- **16 slides** currently (was 17, merged cache slides 6+7)

## Current Direction
Iterating on individual slide visuals. The slide engine, navigation, and step-based click control are all working. Currently refining the cache explainer visual on slide 6 which shows 5 turns with growing horizontal bars, then zooms into Turn 5's cached segment to reveal the two cache tiers (Base Layer = 1hr TTL, Conversation = 5min TTL) as proportionally-scaled bar segments directly underneath.

## What's Done
- Full slide engine with click-controlled step animations (no auto-play)
- Arrow keys navigate slides, clicks/spacebar step through animations
- 16-slide structure with all content populated
- Slide 6: combined cache timeline + tier breakdown into one continuous 9-step flow
  - Steps 1-5: turns appear with growing bars showing cache ratio improvement
  - Step 6: "Cache reads = 10x cheaper" stat
  - Step 7: other turns fade, Turn 5 isolates with "What's in that cached portion?"
  - Step 8: two tier bars appear directly under cached segment, properly aligned
  - Step 9: "/clear kills the conversation" insight
- Tier bars use two shades of green (base = lighter/smaller, conversation = brighter/larger)
- Fixed inline style specificity bug that caused blank slides after title
- Session cost comparison tool embedded as iframe on slide 11

## Rejected Approaches
- **reveal.js framework**: Too much fighting CSS specificity and layout opinions. Custom engine is ~30 lines of JS and gives full control.
- **Auto-playing animations with delays**: User needs click control to time animations with talk track. Replaced all `animation-delay` auto-play with step-gated triggers.
- **Separate slides for cache timeline and tier breakdown**: Merging into one slide gives a smooth continuous flow from growing bars → zoom into cache → tier reveal.
- **Card-style tier blocks**: Too large, didn't visually connect to the green cached bar above. Switched to proportionally-scaled bar segments directly underneath with labels below.
- **Blue/orange tier colors**: Confusing — tiers are both parts of the green "cached" segment, so both should be green (different shades).

## Open Questions
- Slide 8 (session length) and slide 6 both show cumulative context growth — is there too much overlap? Different enough (cache vs. cost framing)?
- Should there be a slide about when to use /compact vs /clear as a decision guide?
- Does the multi-claude slide (12) need a more concrete visual?

## Next Steps
- Continue reviewing each slide's visual quality and animation timing
- Test full run-through for ~10 minute pacing
- Record the video presentation
