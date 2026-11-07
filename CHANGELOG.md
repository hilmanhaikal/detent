# Changelog

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
