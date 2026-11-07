import { createScrub, stepKey } from '@hlmnhkl/detent'

const knob = document.querySelector('#scrub-knob')

// The engine under detent(): you feed it the hand and draw every frame yourself.
const scrub = createScrub({
  value: 4,
  min: 0,
  max: 10,
  land: Math.round,
  period: () => 280,
  onFrame: (v) => (knob.style.rotate = `${v * 27 - 135}deg`),
  onSettle: (v) => knob.setAttribute('aria-valuenow', v),
})

let x = null
knob.addEventListener('pointerdown', (e) => {
  knob.setPointerCapture(e.pointerId)
  x = e.clientX
  scrub.grab()
})
knob.addEventListener('pointermove', (e) => {
  if (x === null) return
  scrub.drag((e.clientX - x) / 20)
  x = e.clientX
})
knob.addEventListener('pointerup', () => {
  x = null
  scrub.release()
})
knob.addEventListener('keydown', (e) => {
  const v = stepKey(e.key, scrub.target, { min: 0, max: 10, step: 1 })
  if (v === null) return
  e.preventDefault()
  scrub.go(v)
})
