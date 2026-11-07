# detent

Controls that click into place.

A detent is the small notch a knob clicks into as you turn it. `detent` gives that feel to anything you drag on the web: a slider, a dial, a ruler, a picker wheel, a sheet.

- **Magnetic marks.** Values are drawn onto marks. A strong mark pulls from further away.
- **A glide that never flies past.** A flick carries on, capped, then lands on a mark.
- **A settle with no bounce.** One spring, timed by you.
- **Keys like the finger.** Arrow, Page, Home and End land where a drag would.
- **Reduced motion built in.** A period of 0 keeps every result and drops the motion.
- **Tiny and plain.** No framework, no dependencies, no styling.

This is an early version. The API will change before 1.0.

```sh
npm install @hlmnhkl/detent
```

```js
import { createScrub } from '@hlmnhkl/detent'

const marks = [0, 25, 50, 75, 100]
const nearest = (v) => marks.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))

const scrub = createScrub({
  value: 50,
  min: 0,
  max: 100,
  land: nearest,
  period: () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280),
  onFrame: (v) => (knob.style.rotate = `${v * 2.7 - 135}deg`),
  onSettle: (v) => console.log('landed on', v),
})

// Feed it the hand: grab() on press, drag(delta) with how far it moved, release() on let-go.
// Keys: go(value) lands on a value with the same glide.
```

Made by Hilman Haikal. It powers the Dial, RulerScrubber and PickerWheel in [hlmnhkl/ui](https://ui.hlmnhkl.my).

## Licence

[MIT](LICENSE)
