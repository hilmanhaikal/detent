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
import { createScrub, stepKey } from '@hlmnhkl/detent'

const knob = document.querySelector('.knob')
const marks = [0, 25, 50, 75, 100]
const nearest = (v) => marks.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))

const scrub = createScrub({
  value: 50,
  min: 0,
  max: 100,
  land: nearest,
  period: () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280),
  onFrame: (v) => (knob.style.rotate = `${v * 2.7 - 135}deg`),
  onSettle: (v) => knob.setAttribute('aria-valuenow', v),
})

// The hand: grab on press, drag by how far it moved, release on let-go.
let x = null
knob.addEventListener('pointerdown', (e) => {
  knob.setPointerCapture(e.pointerId)
  x = e.clientX
  scrub.grab()
})
knob.addEventListener('pointermove', (e) => {
  if (x === null) return
  scrub.drag((e.clientX - x) * 0.5)
  x = e.clientX
})
knob.addEventListener('pointerup', () => {
  x = null
  scrub.release()
})

// Keys land where a drag would.
knob.addEventListener('keydown', (e) => {
  const v = stepKey(e.key, scrub.target, { min: 0, max: 100, step: 25, marks })
  if (v === null) return
  e.preventDefault()
  scrub.go(v)
})
```

Made by Hilman Haikal. It powers the Dial, RulerScrubber and PickerWheel in [hlmnhkl/ui](https://ui.hlmnhkl.my).

## Site

The homepage lives in `site/`. It runs on this repo's own source.

```sh
./node_modules/.bin/vite site --port 5182                              # work on it
./node_modules/.bin/vite build site --outDir ../site-dist --emptyOutDir  # static files in site-dist/
```

## Licence

[MIT](LICENSE)
