# Changelog

## 0.3.0

Objects you turn.

- **`detent3d(el, options)`** lets you spin or tilt an object, and it clicks into the nearest face. A flick carries it on, then it lands with no bounce. Strong faces pull from further away.
- **Faces your way.** List your own, each with yaw, pitch, roll and a name, or use `faces: 'cube'` (six sides) or `faces: 'turntable'` (8 views round, or any number with `views`). `axes` keeps the drag to one axis or lets it turn freely.
- **For CSS 3D and three.js.** It gives yaw, pitch and roll in degrees for CSS, and a quaternion in three.js axes for `model.quaternion.set(...q)`. It draws nothing. Free turns never lock up over the top and always take the short way.
- **Keys and screen readers.** On one axis it is a slider: arrows go one face, Page Up and Page Down a quarter turn, and the value is the face's name. Turning freely, the arrows turn it to the next face that way, and it says the face's name when it lands.
- Reduced motion lands at once on the same face. Haptics are off by default, as everywhere.
- Every 0.2.0 function and low-level export is unchanged.

### Fixed

- `detent2d`: calling `set()` while it glides no longer drops the change event, and new points take effect at once.


## 0.2.0

Three new ways to cross a line and make something happen.

- **`detentThrow(el, options)`** lets you throw a card or sheet. Past 35% of its width, or with a quick flick, it flies off and tells you once. Short of that it springs back. `throw()` and `undo()` are there for your buttons.
- **`detentPull(el, options)`** is pull to refresh. It gets heavier as you pull, shows when it is armed, and holds while your work runs until you call `done()`. On a list it only pulls at the top, so normal scrolling is never in the way. `trigger()` does the same from a button.
- **`detentHold(el, options)`** is hold to confirm, on a fair clock. Let go early and it runs back. A tap, Enter or Space never confirms by itself: it calls `onTap`, so you can show a confirm step.
- **Haptics.** Every control that takes a hand can tick on phones that vibrate, with `haptics: true` (strong marks and key moments) or `'all'`. Off by default, short and gentle, Android only (iPhone Safari has no vibration API).
- Every 0.1.0 function and low-level export is unchanged.


## 0.1.0

One call now does what took 40 lines.

- **`detent(el, options)`** wires finger, mouse, keys and screen reader to one value. It covers sliders, dials (`path: 'turn'`), picker wheels (`loop: true`), rulers and sheets (`snap: 'marks'`).
- **`detentScroll()`** lets the page settle onto sections. Strong sections pull harder, it never rests halfway, and it never moves while your hand is on the page. In-page links glide and move focus to the heading.
- **`detent2d(el, options)`** lets you drag anything onto the nearest point or corner, with arrow keys and a polite announcement of where it landed.
- Events `detent:input` (every frame) and `detent:change` (once, on a new resting value). Callbacks carry the same numbers.
- ARIA is set for you: role and tabindex when missing, min, max, now and text kept in step. `destroy()` puts every attribute back.
- Reduced motion is read live: same results, no glide, no page settle.
- Every result can be stopped with an `AbortSignal`.
- `stepKey` can go round a loop (`loop: true`), and Page Up and Page Down go to strong marks first (`strong: [...]`).
- Every low-level function from 0.0.1 is still there, with the same signature.

## 0.0.1

The core: marks, strong marks, a capped glide, a settle with no bounce, key steps and reduced motion.
