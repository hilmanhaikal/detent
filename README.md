# detent

Controls that click into place.

A detent is the small notch a knob clicks into as you turn it. `detent` gives that feel to anything you drag on the web: a slider, a dial, a picker wheel, a sheet, the page scroll, a floating video.

- **One call per control.** Finger, mouse, keys and screen reader are wired for you.
- **Magnetic marks.** Values are drawn onto marks. A strong mark pulls from further away.
- **A glide that never flies past.** A flick carries on, capped, then lands. No bounce.
- **Reduced motion built in.** Every result stays. Only the motion goes.
- **Tiny and plain.** No framework, no dependencies, no styling. You draw it.

## Why detent

**Vision.** Every control on the web should feel as good as the best phone app, for everyone who uses it.

**Mission.** detent gives developers the feel of real, physical controls in a few lines of code: values that click into place, motion that never overshoots, and keyboard and screen reader support from the start. Small, free and open, so anyone can use it.

**What we believe:**

1. **Feel is a feature.** A slider that lands where you meant is better than one that looks good.
2. **Everyone, by default.** If it does not work with a keyboard, a screen reader or reduced motion, it is not done.
3. **Never fight the hand.** detent follows you. It never pulls the page or a control away from where you put it.
4. **No bounce for show.** Things settle calmly, like a real knob clicking into its notch.
5. **Small enough to forget.** A few kilobytes and no dependencies, so adding it is never a hard choice.
6. **Draw nothing.** detent is the feeling, not the look. Your design stays yours.

**Controls that click into place.**

This is an early version. The API may change before 1.0.

```sh
npm install @hlmnhkl/detent
```

## A control: `detent()`

Sliders, dials, rulers, picker wheels and sheets are all one value under a hand. Only the path the hand takes changes.

```js
import { detent } from '@hlmnhkl/detent'

// A slider. Every 10 is a step, and 50 pulls harder.
const volume = detent(el, {
  min: 0,
  max: 100,
  step: 10,
  marks: [0, { at: 50, strong: true }, 100],
  cssVar: '--value',
})
```

Here `el` is the track, and the thumb sits inside it, so the thumb reads the same variable:

```css
.track { position: relative; }
.thumb { position: absolute; left: calc(var(--value) * 1%); translate: -50% 0; }
```

More shapes:

```js
// A dial: 270 degrees of turn from 0 to 25.
detent(dial, { min: 0, max: 25, path: 'turn', sweep: 270, onInput: (v) => (dial.style.rotate = `${v * 10.8 - 135}deg`) })

// A picker wheel that goes round: 24 hours, rows 44px tall.
detent(wheel, { loop: true, count: 24, path: 'y', size: 44, text: (h) => `${h} hours`, onInput: drawRows })

// A sheet that rests only at its heights. A tap steps it up.
const heights = [0.24, 0.56, 0.92]
const sheet = detent(handle, {
  min: 0.24, max: 0.92, step: 0.01,
  marks: heights, snap: 'marks',
  path: 'y', size: () => frame.clientHeight,
  onTap: (h) => sheet.go(heights[(heights.indexOf(h) + 1) % 3]),
})
```

Read it, listen to it, change it, remove it:

```js
volume.value // the settled value
volume.at // where it is drawn now, between values while it moves

el.addEventListener('detent:input', (e) => e.detail.at) // every frame while it moves
el.addEventListener('detent:change', (e) => save(e.detail.value)) // once, when it rests on a new value

volume.go(80) // glides there; volume.go(80, { instant: true }) jumps
volume.set({ marks: [0, 25, 75, 100] }) // new marks land it again; a new min or max keeps it inside
volume.destroy() // or pass { signal } and abort it
```

The callbacks `onInput`, `onChange` and `onMark` carry the same numbers as the events. Use whichever fits.

| Option | Default | What it does |
| --- | --- | --- |
| `min`, `max` | | The range. Leave out for a loop. |
| `loop`, `count` | | A loop of `count` places, 0 to `count - 1`. |
| `step` | 1 | Every resting place is a multiple of this. |
| `marks` | none | Numbers or `{ at, strong }`. Marks pull the value in. |
| `reach` | `{ reach: 0.35, strong: 1.5 }` | How far marks pull, as a share of the smallest gap between marks. |
| `snap` | `'step'` | `'marks'` rests only on a mark. |
| `path` | `'x'` | `'x'`, `'y'` (up is more) or `'turn'`. |
| `size` | length / range | Pixels per unit, or a function that returns it. |
| `sweep` | 270 | Degrees from `min` to `max` on a turn. |
| `invert` | false | The drag moves the content, not a thumb (a ruler under a fixed pin). |
| `coast`, `maxSpeed` | 0.2, none | How far a flick carries, and its top speed. |
| `edge` | `step * 0.6` | How far a drag stretches past an end. |
| `period` | 280 | One spring swing, in ms. |
| `motion` | `'auto'` | `'auto'` follows reduced motion. `'reduce'` or `'full'` force it. |
| `cssVar` | off | A custom property that gets the live value. |
| `text` | `String(v)` | The words for `aria-valuetext`. |
| `keys` | built in | Your own key map: `(key, value) => value or null`. |
| `onTap` | none | A press that barely moved. |

While the hand holds it, the element has `data-held`. While it moves, it has `data-moving`.

## The page: `detentScroll()`

The page settles onto sections when a wheel, trackpad or finger stops. Strong sections pull harder. It never rests halfway between two close sections, and tall sections are free to read in the middle.

```html
<section data-mark="strong" id="top">…</section>
<section data-mark id="pricing">…</section>
```

```js
import { detentScroll } from '@hlmnhkl/detent'

const page = detentScroll({ offset: document.querySelector('header') })
page.index // the section it rests on, or null
page.go(2) // glides to the third section
page.destroy()
```

It never fights the hand: any wheel, touch, key or mouse press stops a settle at once. Keys, the scrollbar, find in page and screen readers scroll natively, with no settle after them. In-page links (`href="#pricing"`) glide too, then move focus to the section's heading. With reduced motion there is no settle at all, and links jump.

## Drag anywhere: `detent2d()`

Drag something, and it settles onto the nearest point. A flick carries it toward where it was going.

```js
import { detent2d } from '@hlmnhkl/detent'

// A floating video that snaps to the corners of the screen.
const pip = detent2d(video, { points: 'corners', inset: 16, cssVar: ['--x', '--y'] })
```

```css
video { position: fixed; left: 0; top: 0; translate: calc(var(--x) * 1px) calc(var(--y) * 1px); }
```

Points can be your own: `points: [{ x, y, name: 'Dock', strong: true }]`, in px from the bounds' top-left. Arrow keys move to the next point that way. Home and End go to the first and last. `pip.index`, `pip.at`, `pip.go(i)`, `pip.set()` and `pip.destroy()` work as above. The events are `detent2d:input` and `detent2d:change`.

## Accessibility

What detent does for you:

| | `detent()` | `detent2d()` | `detentScroll()` |
| --- | --- | --- | --- |
| `role` | `slider`, or `spinbutton` in a loop, only if the element has none | `group` with `aria-roledescription="movable"`, only if the element has none | none |
| `tabindex="0"` | if missing | if missing | |
| `aria-valuemin`, `aria-valuemax` | kept in step (left out in a loop) | | |
| `aria-valuenow`, `aria-valuetext` | written when it rests | | |
| `aria-orientation` | on a slider | | |
| Speaks | the value, through the slider | the point's name, in one shared polite live region, made when it starts (`announce: false` turns it off) | nothing; native scroll is left alone |
| Keys | Arrows one step, Page Up and Down to the next strong mark (or mark, or 10 steps), Home and End to the ends. A loop goes round. | Arrows to the next point that way, Home and End | native |

What you must still do:

- **Give it a name** with `aria-label` or `aria-labelledby`. detent warns once in the console if there is none.
- **Write good words.** Pass `text`, so a screen reader says "RM 250" or "19:30", not "250".
- **Show focus.** Style `:focus-visible`. detent draws nothing.
- **Check `touch-action`.** If your CSS sets none, detent sets `pan-y` on a horizontal control, `pan-x` on a vertical one and `none` on a turn or in 2D, so the page still scrolls past it.

`destroy()` puts every attribute back the way it was.

## Reduced motion

With `prefers-reduced-motion: reduce`, controls land on the same value with no glide, and page settles turn off. It is read live, so a change in the system setting applies at once. Set `motion: 'full'` or `'reduce'` to choose yourself.

## React, Vue, Svelte

detent takes an element and gives back `destroy`, so it fits any framework's mount and unmount.

```tsx
function Volume({ onChange }: { onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => detent(ref.current!, { min: 0, max: 100, step: 10, cssVar: '--value', onChange }).destroy, [])
  return <div ref={ref} aria-label="Volume" className="slider" />
}
```

To pass fresh callbacks after a render, keep the result and call `set({ onChange })`. In Vue, call it in `onMounted` and `destroy` in `onUnmounted`, or listen with `@detent:change`. In Svelte, the result has `set` and `destroy`, so it works as an action.

Nothing runs on import, so server rendering is safe. Call detent in an effect, once the element exists.

## Size

Minified and gzipped, with tree-shaking. 1 KB is 1,024 bytes.

| You import | Size |
| --- | --- |
| `detent` | 4.0 KB |
| `detentScroll` | 2.1 KB |
| `detent2d` | 2.7 KB |
| All three | 6.5 KB |
| Everything, low level included | 6.9 KB |
| Only the low level (`createScrub` and `stepKey`) | 1.6 KB |

## Low level

Everything detent is built from stays public: `createScrub`, `glide`, `springTo`, `follow`, `attract`, `magnetTo`, `pull`, `rubber`, `stepKey`, `wheelSteps`, `speedTracker`, `roundTo`, `steps` and more. Use them when you wire the hand yourself. [hlmnhkl/ui](https://ui.hlmnhkl.my) does, for its Dial, RulerScrubber and PickerWheel.

## Site and tests

The homepage lives in `site/` and runs on this repo's own source.
The docs are in `site/docs/`. Each demo there is a file in `site/docs/demos/` or `site/docs/recipes/`, and the page shows that same file. The option tables are read from the types in `src/` when the page is built.

The site and the browser tests need Vite and Playwright. This repo does not install them yet, so on a fresh clone add them first:

```sh
npm install --save-dev vite playwright
npx playwright install chromium firefox webkit
```

Then:

```sh
./node_modules/.bin/vite site --port 5182                              # work on it
./node_modules/.bin/vite build site --outDir ../site-dist --emptyOutDir  # static files in site-dist/
npm test                                                                 # pure logic, with node:test
```

Browser tests use Playwright against the repo served on port 5182:

```sh
./node_modules/.bin/vite . --config site/vite.config.ts --port 5182 --strictPort
npm run test:browser   # in a second shell; add webkit with: node test/browser.mjs webkit
```

`test/browser.mjs` loads Playwright from `node_modules/playwright`. To use a copy from somewhere else, set `PLAYWRIGHT` to its `index.mjs`.
```

## Licence

[MIT](LICENSE)
