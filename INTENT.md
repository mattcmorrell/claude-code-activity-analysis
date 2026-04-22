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
- **Iframe embed**: `session-cost-comparison.html` loaded live on slide 12
- **14 slides** (reduced from 15 — deleted standalone screenshots slide, merged screenshot note into /compact slide)

## Current Slide Order (14 slides)
1. **Title** — "Token Traction" with subtitle
2. **Reframe + Cards** — Efficiency vs Traction panels, then 3 traction cards animate in below. 4 steps.
3. **Playbook** — 5 numbered takeaways: Session length, Keep warm, Multi-claude, Opus over Sonnet, Memory files
4. **Caching** — Two-panel graphic: Max Plan (flat fee, caching invisible) vs Enterprise/API (pay per token, cache hits save money). Bridge: "making that green bar as big as possible"
5. **How Caching Works** — 8-step flow: turns with growing bars → cache stat → tier breakdown with big TTL graphics (amber 1hr base, green 5min conversation). "cache purged after X of inactivity" captions.
6. **Warm or Cold** — Binary warm/cold blocks (< 5 min / > 5 min), cold rewrite at 1.25× cost callout, small-vs-big cache size comparison (10k=$0.005 vs 150k=$0.56). 3 steps.
7. **Multi-Claude Strategy** — Bad vs Good side-by-side: Bad = 3 deep sessions (A/B/C) with >5 min gaps going cold; Good = 1 deep (green) warm + 2 shallow (blue). 3 steps.
8. **Tools to Manage Convo Length** — Two cards: /compact (blue) and /clear (red). 1 step.
9. **/compact** — Surgical reduction visual (oldest dissolve, middle summarize, recent preserved, screenshots survive). Step 3 animates in "Screenshots don't get compressed" note. 3 steps.
10. **/clear — Nuke** — Nuclear option visual. "Everything. Gone." in red. /clear nukes EVERYTHING including base layer. 2 steps.
11. **Opus vs Sonnet** — Step 1: big "1.67×" price callout. Step 2: Sonnet track (12 dots, mix of productive/wasted/fix). Step 3: Opus track (4 dots, all productive). Step 4: "Let's see this live..." 4 steps.
12. **Live Cost Comparison** — Full-width iframe of `session-cost-comparison.html`
13. **Long-Term Memory** — Files that survive /clear (INTENT.md, CLAUDE.md, knowledge.md)
14. **Closing** — "Think bigger. Use more tokens. Go further." with recap pills

## Current Direction
Iterating on individual slide visuals and narrative flow. Major restructuring complete — slides now flow: cache mechanics → warm/cold → multi-claude → tools intro → compact → clear → model choice → live demo → memory → closing.

## What's Done
- Full slide engine with click-controlled step animations (no auto-play)
- Arrow keys navigate slides, clicks/spacebar step through animations
- 14-slide structure with all content populated
- Slide 1: Fixed JS initialization so first slide is visible on load
- Slide 2: Merged traction cards underneath efficiency/traction panels. 4 steps.
- Slide 3: Playbook reordered to match deck narrative (Opus moved to #4)
- Slide 4: "Caching" — bar segment graphics showing cache visibility on Max vs Enterprise
- Slide 5: Cache timeline + tier breakdown, big TTL graphics (amber "1 hr" / green "5 min"), "cache purged after..." captions. Base layer = amber, Conversation = green for visual distinction.
- Slide 6: Reworked from 3-zone gradient to binary warm/cold with 1.25× rewrite cost and cache size comparison
- Slide 7: Bad vs Good multi-claude comparison. Bad side: Deep Session A/B/C with ">5 min gap" dividers, all cold/red. Good side: deep=green, shallow=blue.
- Slide 8: New "Tools to Manage Convo Length" intro with /compact and /clear cards
- Slide 9: /compact with screenshot note animating in on step 3
- Slide 10: /clear nuke — "Everything. Gone." in red
- Slide 11: Opus vs Sonnet — big 1.67× price callout first, then turn dot tracks, then transition
- Slide 12: Live iframe embed
- Slide 13: Long-term memory files
- Slide 14: Closing with recap pills
- Deleted standalone screenshots slide — merged screenshot note into /compact slide

## Rejected Approaches
- **reveal.js framework**: Too much fighting CSS specificity and layout opinions. Custom engine is ~30 lines of JS and gives full control.
- **Auto-playing animations with delays**: User needs click control to time animations with talk track.
- **Separate slides for cache timeline and tier breakdown**: Merging gives smooth continuous flow.
- **Card-style tier blocks**: Too large, didn't visually connect to the green cached bar above.
- **Both tiers green**: Hard to distinguish base from conversation. Fixed: base=amber, conversation=green.
- **"Base layer survives /clear"**: Incorrect — /clear nukes everything including the base layer.
- **Text-heavy tier explanations on slide 5**: Replaced with big TTL number graphics.
- **Mini-timeline graphics for tier TTL**: Too small and fiddly. Replaced with big "1 hr" / "5 min" numbers + gradient bars.
- **Enterprise callout on slide 4**: Removed — slide focuses purely on cache economics.
- **3-zone warmth gradient (warm/cooling/cold)**: Cache is binary — warm or cold, no "cooling" state. Replaced with two blocks.
- **Session length bar chart slide**: Removed as standalone slide. Convo length management now introduced via /compact and /clear tools instead.
- **Standalone screenshots slide**: Deleted. Screenshot note merged into /compact slide as step 3 animation.
- **Opus vs Sonnet cost bars (growWidth animation)**: Broken layout. Replaced with simple text summaries.
- **Deep session = blue in multi-claude**: Changed to green for warm. Shallow = blue.

## Open Questions
- None currently — all slides have been reviewed and iterated on

## Next Steps
- Full run-through review of all 14 slides for visual quality and animation timing
- Test ~10 minute pacing
- Record the video presentation
