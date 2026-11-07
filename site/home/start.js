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
