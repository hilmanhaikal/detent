# Plan

detent is the engine: how a value moves under a hand. It draws nothing. Components (like those in
[hlmnhkl/ui](https://ui.hlmnhkl.my)) are built on it. First users: developers building web apps for
phones who want controls that feel native and are accessible by default.

| Version | What | Why |
| --- | --- | --- |
| 0.0.1 | The core: marks, strong marks, capped glide, no-bounce settle, key steps, reduced motion | Done (7 Nov 2026), claims the name on npm |
| 0.1.0 | A friendly API in one line (`detent(el, { marks })`) that wires finger, mouse, keys and screen reader; scroll detents (the page settles onto sections, strong ones pull harder, never rests halfway); 2D magnets (drag anything, it settles onto the nearest point or corner) | Makes it easy to use; scroll is already built for the homepage; 2D with keys is a real gap. Released 7 Nov 2026. `detent` alone was 4.0 KB, all three together 6.5 KB. |
| 0.2.0 | Cross a line to trigger: throw (fling a card away or spring back, with SwipeDeck's measured rule), pull (pull to refresh or reveal, armed at a line, never fights the scroll), hold (hold to confirm on a fair clock, a tap asks for a confirm step). Optional, gentle haptics on every control. | Throw grows out of hlmnhkl/ui's SwipeDeck, hold out of its HoldToConfirm; all three are gestures people already know. Built (7 Nov 2026), not released yet. The three new ones together 4.5 KB; all six 9.7 KB. |
| 0.3.0 | 3D rotation detents: spin or tilt an object and it clicks into set angles; strong angles; arrow keys turn it; examples with CSS 3D and three.js | Product viewers, card flips, 3D carousels, Hikayat's polaroid |
| 0.4.0 | Reorder (drag a row, the others make room and it clicks into its slot) and pinch steps (zoom that clicks into levels) | Lists and photo viewers; the order was agreed with the owner (7 Nov 2026) |

Rules: each module is small and separate, so you only load what you use. The main `detent`
function stays under about 4 KB gzip, and the three 0.1.0 functions together under 7 KB (owner, 7 Nov
2026). In 0.2.0 haptics took `detent` to 4.2 KB and the three to 6.9 KB. No dependencies, MIT. Every module has keyboard steps, works with screen
readers through one settled value, and keeps every result with reduced motion.

Not detent: anything you see (styles, shapes, typeset maths). Those are components.
