# detent

Controls that click into place.

A detent is the small notch a knob clicks into as you turn it. `detent` gives that feel to anything you drag on the web: a slider, a dial, a picker wheel, a sheet, the page scroll, a floating video, a card you throw, a list you pull, a button you hold and an object you turn.

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
| `haptics` | false | A tick on phones that vibrate. `true` for strong marks only, `'all'` for every value. See [Haptics](#haptics). |

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

## Throw it: `detentThrow()`

Drag a card past a line and let go: it flies off that way. Short of the line it springs back, with no bounce.

```js
import { detentThrow } from '@hlmnhkl/detent'

const card = detentThrow(el, {
  directions: 'x', // or 'y', 'both', or a list such as ['left']
  cssVar: ['--x', '--y', '--tilt'],
  onThrow: (way) => dismiss(way),
})

passButton.onclick = () => card.throw('left') // buttons are yours: a gesture is never the only way
undoButton.onclick = () => card.undo() // plays the throw backwards
```

The rule: past 35% of its width (`line`), or a flick over 600 px/s (`flick`) that has moved at least 40 px (`flickMin`). `onThrow` fires once per throw. A `throw()` during a throw is ignored; one during an undo plays once, when the undo ends. Past the line the element has `data-armed` with the way; once gone, `data-thrown`. The events are `detentthrow:input` and `detentthrow:throw`.

## Pull it: `detentPull()`

Pull down past a line and let go to trigger, as in pull to refresh.

```js
import { detentPull } from '@hlmnhkl/detent'

const refresh = detentPull(list, {
  cssVar: '--pull', // px, for your content's translate
  onArm: (armed) => (cue.textContent = armed ? 'Let go to refresh' : 'Pull to refresh'),
  onPull: () => load().finally(() => refresh.done()),
})
refreshButton.onclick = () => refresh.trigger() // the same pull, for keys and screen readers
```

It follows the hand, then gets heavier, and never passes `max`. At the `line` (64 px) it arms: `onArm(true)` and `data-armed`. Let go while armed and `onPull` fires once; it holds at `rest` with `aria-busy="true"` until you call `done()`. Short of the line it springs back. On a scroll container it only pulls at the top and only downward, so the native scroll is never fought. The events are `detentpull:input`, `detentpull:arm` and `detentpull:pull`.

## Hold it: `detentHold()`

Press and hold to confirm, on a fair clock.

```js
import { detentHold } from '@hlmnhkl/detent'

const hold = detentHold(button, {
  time: 1500,
  cssVar: '--progress', // 0 to 1, for your fill
  onTap: () => openConfirmStep(), // a tap, Enter or Space never confirms by itself
  onConfirm: () => remove(),
})
hold.reset() // after onConfirm it stays done until you call this
```

It fills at an even speed. Let go early and it runs back in about 140 ms. A finger that slides 16 px off, a page scroll or a blur cancels. Holding Enter or Space works too, but holding a key must never be the only way, so a tap calls `onTap` for your confirm step. `onConfirm` fires once. The events are `detenthold:input`, `detenthold:tap`, `detenthold:confirm` and `detenthold:cancel`.

## Turn it: `detent3d()`

Spin or tilt an object, and it clicks into the nearest face. A flick carries it on, capped, then it lands with no bounce.

```js
import { detent3d } from '@hlmnhkl/detent'

// A cube: front, right, back, left, top, bottom.
const cube = detent3d(el, { faces: 'cube', cssVar: ['--yaw', '--pitch', '--roll'] })

// A product turntable: 8 views round the upright axis.
detent3d(box, { faces: 'turntable', views: 8, names: ['Front', 'Front and left side' /* ... */] })

// Your own faces, and three.js.
detent3d(view, {
  faces: [{ yaw: 0, name: 'Front' }, { yaw: 180, pitch: -30, name: 'Back, from above', strong: true }],
  onInput: (rotation, q) => model.quaternion.set(...q),
})
```

```css
.cube { transform-style: preserve-3d; transform: rotateY(calc(var(--yaw) * 1deg)) rotateX(calc(var(--pitch) * 1deg)) rotateZ(calc(var(--roll) * 1deg)); }
```

A face is `{ yaw, pitch, roll, name, strong }` in degrees. `yaw` turns round the upright axis, positive to the right. `pitch` tilts, positive tilts the front up, so `-90` shows the top. `roll` is clockwise, like CSS `rotate`. `axes` limits the drag to `'yaw'`, `'pitch'` or `'both'` (a turntable is `'yaw'`, the rest `'both'`). `degreesPerPx` sets how far a drag turns it (0.5). Strong faces pull from further away. On a cube, the top and bottom rest in any of four quarter turns, so they can be reached from every side.

`onInput(rotation, quaternion)` gives `{ yaw, pitch, roll }` for CSS and a quaternion `[x, y, z, w]` in three.js axes (y up). Free turns use quaternions and slerp, so it never locks up over the top and always takes the short way. On one axis it is a plain angle that goes round the short way and keeps counting past a full turn, so it never jumps. `cube.index`, `cube.rotation`, `cube.quaternion`, `cube.go(i)`, `cube.set()` and `cube.destroy()` work as above. The events are `detent3d:input` and `detent3d:change`.

On one axis it is a `slider`: the value is the face's place in turning order, the text its name. Arrows go one face, Page Up and Page Down a quarter turn, Home and End to the ends, and it goes round. Free, it is a `group` described as rotatable: the arrows turn it to the next face that way, and the shared polite live region says the face's name when it lands. Mark the faces you draw `aria-hidden="true"`.

## Move it: `animate()`

Move an element, an object's numbers or one number. By default it is a spring that settles with no bounce. Give it a `duration` and it runs on an ease.

```js
import { animate } from '@hlmnhkl/detent'

animate(card, { to: { y: 0, opacity: 1 } }) // a spring, no bounce
animate(card, { to: { x: 120, rotate: 8 }, period: 600, damping: 1.4 }) // slower and softer
animate(bar, { to: { '--fill': 1 }, duration: 300, ease: 'inOut' }) // a custom property on an ease
animate(0, { to: 128, duration: 700, onUpdate: (v) => (total.textContent = v.toFixed(2)) }) // a number

const a = animate(card, { from: { scale: 0.9 }, to: { scale: 1 }, delay: 100 })
a.pause(); a.seek(120); a.play(); a.stop()
await a.finished // true when it lands, false when stopped or taken over; it never rejects
```

On an element, `x` and `y` (px), `scale` and `rotate` (degrees) make one `transform`, in that order, and `opacity` and `--custom` properties are written as they are. Nothing else: layout properties such as `width` are skipped with a console warning, so the page never lays out again mid-flight. A later animation of `x` keeps the `y` an earlier one left. It writes the element's `transform`, so keep your own offsets in the CSS `translate` property or on a wrapper.

| Option | Default | What it does |
| --- | --- | --- |
| `to`, `from` | `from`: where it is now | The values. A number for a number target. |
| `period` | 400 | One spring swing, in ms. |
| `damping` | 1 | 1 is as quick as it can be with no bounce. Higher is softer. Below 1 counts as 1. |
| `duration`, `ease` | none, `'out'` | A fixed time in ms on `'linear'`, `'in'`, `'out'`, `'inOut'`, `[x1, y1, x2, y2]` or a function. |
| `delay` | 0 | Wait this long before it starts. Values are read when it starts. |
| `onUpdate`, `onDone` | none | Every frame with the values, and once when it lands. |
| `motion` | `'auto'` | `'auto'` follows reduced motion. `'reduce'` or `'full'` force it. |
| `signal` | none | Aborting it stops it. |

A spring ends when it is within 0.5 of its target, or 0.5% of the way for small values such as opacity. A new animation of the same property takes over from where the old one is, at its speed, so there is no jump. With reduced motion it lands on the end at once, and `onUpdate` and `onDone` still run. Time stops while the tab is hidden. `destroy()` is `stop()`, bound.

## Choreograph it: `timeline()`

Many animations on one clock. Each step starts at its place in time, and the whole can play, pause, reverse and seek.

```js
import { timeline } from '@hlmnhkl/detent'

const tl = timeline()
  .add(card, { from: { y: 10, opacity: 0 }, to: { y: 0, opacity: 1 } })
  .add(tick, { from: { scale: 0.6 }, to: { scale: 1 } }, '-=300')
  .label('shown')
  .add(note, { to: { opacity: 1 }, duration: 200 }, '+=100')

tl.pause(); tl.seek('shown'); tl.reverse(); tl.play()
tl.duration // ms; a spring step lasts until it settles
```

A position is ms from the start, `'+=ms'` or `'-=ms'` from the end so far, `'<'` with the step before, or a label (an unknown label is made at the end). Leave it out to start at the end so far. A step with no `from` starts where the step before it on the same property ends, so seeking is exact. It plays once your steps are added, unless you pass `paused: true`. With reduced motion `play()` lands on the end at once, and `seek()` still works.

`tl.marks()` gives the labels as detent marks. So a detent control can scrub a timeline and settle on its labels, with keys and a screen reader for free:

```js
const marks = tl.marks()
detent(slider, { min: 0, max: tl.duration, marks, snap: 'marks', text: (t) => names[marks.findIndex((m) => m.at === t)], onInput: (t) => tl.seek(t) })
```

## Scroll scenes: `scrollScene()`

A scene is a timeline whose time is the page's scroll through a range. It only reads the scroll, never moves it, so the wheel, the finger and the keys stay the reader's. Scroll back and it plays back.

```js
import { detentScroll, scrollScene, timeline } from '@hlmnhkl/detent'

const tl = timeline({ paused: true }).add(card, { from: { y: 40, opacity: 0 }, to: { y: 0, opacity: 1 } }).label('in')
const scene = scrollScene(tl, { target: section, start: 'top bottom', end: 'bottom top' })

detentScroll({ marks: scene.marks }) // optional: the page settles onto the scene's labels
```

`start` and `end` name the target's edge, then the screen's: `top`, `center`, `bottom` or a percentage. Each frame works out the time from where the page is, so a fast fling past a scene still lands on its end or start. With reduced motion a scene jumps to its end as it comes in, and back to its start once it is gone above. `detentScroll`'s `marks` now also takes scroll positions as numbers, or a function it reads again on each measure.

## Frame budget: `frameBudget`

Every detent module moves on one shared frame: one `requestAnimationFrame` however much moves. Frames stop in a hidden tab, and `animate()` and `timeline()` stop their time too. If no frame comes for 100 ms while the page is shown, a timer stands in, so motion still ends on time.

When frames run long (past 28 ms on average, as on a low-end phone), the budget is low and motion is drawn every other frame, which halves the style writes. Below 20 ms it is back to every frame. Every motion runs on real elapsed time and writes its end value when it lands, so a skipped frame never changes where it ends. A drag follows the pointer, not the frame, so the hand is never skipped.

```js
import { frame, frameBudget } from '@hlmnhkl/detent'

frameBudget.low // true when recent frames run long: show fewer effects
frameBudget.frameMs // the recent time between frames, in ms
frameBudget.force(true) // a "save power" setting; null measures again
const cancel = frame((now) => draw(now)) // your own work on the same frame
```

## Haptics

`detent()`, `detent2d()`, `detent3d()`, `detentThrow()`, `detentPull()` and `detentHold()` take `haptics`, off by default. `true` ticks only on strong marks and key moments: a pull that arms, a hold that completes, a throw past its line. `'all'` also ticks every plain value, for wheels with few rows. A tick is about 8 ms, a strong one about 12 ms, at most one every 80 ms, and only for the person's own moves, never for `go()`. It works on Android, not on iPhone, because Safari has no vibration API. Use it for the clicks that matter, not every step.

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
- **Check `touch-action`.** If your CSS sets none, detent sets `pan-y` on a horizontal control, `pan-x` on a vertical one and `none` on a turn, in 2D or in 3D, on that element only, so the page still scrolls past it.
- **Give every gesture another way.** `detentThrow`, `detentPull` and `detentHold` add no role. Wire buttons to `throw()`, `undo()` and `trigger()`, and use `onTap` for a confirm step. Say results in your own polite live region.

`detent3d()` is a `slider` on one axis and a rotatable `group` when it turns freely. See [Turn it](#turn-it-detent3d).

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
| `detent` | 4.2 KB |
| `detentScroll` | 2.1 KB |
| `detent2d` | 2.9 KB |
| `detent`, `detentScroll` and `detent2d` | 6.9 KB |
| `detentThrow` | 2.9 KB |
| `detentPull` | 2.0 KB |
| `detentHold` | 1.6 KB |
| `detentThrow`, `detentPull` and `detentHold` | 4.5 KB |
| All six | 9.7 KB |
| `detent3d` | 4.2 KB |
| All seven | 11.9 KB |
| Everything, low level included | 12.2 KB |
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

## Security

detent has no dependencies and no install scripts, and a check runs before every publish. To report a
problem privately, see [SECURITY.md](SECURITY.md).

## Licence

[MIT](LICENSE)
