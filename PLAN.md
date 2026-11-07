# Plan

detent is the engine: how a value moves under a hand. It draws nothing. Components (like those in
[hlmnhkl/ui](https://ui.hlmnhkl.my)) are built on it. First users: developers building web apps for
phones who want controls that feel native and are accessible by default.

| Version | What | Why |
| --- | --- | --- |
| 0.0.1 | The core: marks, strong marks, capped glide, no-bounce settle, key steps, reduced motion | Done (7 Nov 2026), claims the name on npm |
| 0.1.0 | A friendly API in one line (`detent(el, { marks })`) that wires finger, mouse, keys and screen reader; scroll detents (the page settles onto sections, strong ones pull harder, never rests halfway); 2D magnets (drag anything, it settles onto the nearest point or corner) | Makes it easy to use; scroll is already built for the homepage; 2D with keys is a real gap |
| 0.2.0 | 3D rotation detents: spin or tilt an object and it clicks into set angles; strong angles; arrow keys turn it; examples with CSS 3D and three.js | Product viewers, card flips, 3D carousels, Hikayat's polaroid |
| Later | Throw (fling away or spring back, with a clear rule), pinch steps (zoom that clicks into levels) | Throw grows out of hlmnhkl/ui's SwipeDeck |

Rules: each module is small and separate, so you only load what you use. The whole engine stays
under about 6 KB gzip, no dependencies, MIT. Every module has keyboard steps, works with screen
readers through one settled value, and keeps every result with reduced motion.

Not detent: anything you see (styles, shapes, typeset maths). Those are components.
