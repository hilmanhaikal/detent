# Plan

detent is a general motion engine that is accessible and natural by default (owner, 8 Nov 2026). It
does what people expect from a motion engine, and every module comes with keyboard support, screen
readers, reduced motion, care for low-end phones and the calm no-bounce feel, where other engines leave
that to the developer. It draws nothing. Components (like those in [hlmnhkl/ui](https://ui.hlmnhkl.my))
are built on it. First users: developers building web apps for phones.

| Version | What | Why |
| --- | --- | --- |
| 0.0.1 | The core: marks, strong marks, capped glide, no-bounce settle, key steps, reduced motion | Done (7 Nov 2026), claims the name on npm |
| 0.1.0 | A friendly API in one line (`detent(el, { marks })`) that wires finger, mouse, keys and screen reader; scroll detents (the page settles onto sections, strong ones pull harder, never rests halfway); 2D magnets (drag anything, it settles onto the nearest point or corner) | Makes it easy to use; scroll is already built for the homepage; 2D with keys is a real gap. Released 7 Nov 2026. `detent` alone was 4.0 KB, all three together 6.5 KB. |
| 0.2.0 | Cross a line to trigger: throw (fling a card away or spring back, with SwipeDeck's measured rule), pull (pull to refresh or reveal, armed at a line, never fights the scroll), hold (hold to confirm on a fair clock, a tap asks for a confirm step). Optional, gentle haptics on every control. | Throw grows out of hlmnhkl/ui's SwipeDeck, hold out of its HoldToConfirm; all three are gestures people already know. Released 7 Nov 2026. The three new ones together 4.5 KB; all six 9.7 KB. |
| 0.3.0 | 3D rotation detents: spin or tilt an object and it clicks into set angles; strong angles; arrow keys turn it; examples with CSS 3D and three.js | Product viewers, card flips, 3D carousels, Hikayat's polaroid. Built 7 Nov 2026. `detent3d` alone is 4.2 KB, over the 3 KB aim: the quaternion maths and two roles (slider and group) cost about 2.6 KB on top of the shared parts. All seven 11.9 KB. |
| 0.4.0 | Animate (move any element or value with springs or easing, on its own or in sequence) and Timeline (choreograph many animations) | Every general engine needs these; they become accessible by default here |
| 0.5.0 | Morph (an element moves or resizes smoothly to its new place, with no jump) and Text (split text into words or letters and animate them, still read as one by screen readers) | Shared-element and layout moves; kinetic type that stays readable |
| 0.6.0 | Scroll scenes (animation tied to scroll position, never hijacking it) and Frame budget (one shared clock that eases off on low-end phones and pauses in hidden tabs) | Scroll stories; the frame budget is a gap nobody serves |
| Later | Reorder (rows make room and click into their slot), pinch steps (zoom that clicks into levels) | Lists and photo viewers |

Rules: each module is small and separate, so you only load what you use. The main `detent`
function stays under about 4 KB gzip, and the three 0.1.0 functions together under 7 KB (owner, 7 Nov
2026). In 0.2.0 haptics took `detent` to 4.2 KB and the three to 6.9 KB. No dependencies, MIT. Every module has keyboard steps, works with screen
readers through one settled value, and keeps every result with reduced motion.

Not detent: anything you see (styles, shapes, typeset maths). Those are components. The name stays "detent" for the whole engine, the way GSAP names nothing it does.
