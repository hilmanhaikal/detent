import { createScrub, stepKey } from '@hlmnhkl/detent'

const knob = document.querySelector('#scrub-knob')
const cap = knob.querySelector('.d-cap')
const draw = (v) => (cap.style.rotate = `${v * 27 - 135}deg`)

// The engine under detent(): you feed it the hand and draw every frame yourself.
const scrub = createScrub({
  value: 4,
  min: 0,
  max: 10,
  attract: (raw) => raw + (Math.round(raw) - raw) * 0.4,
  land: Math.round,
  period: () => 280,
  onFrame: draw,
  onSettle: (v) => knob.setAttribute('aria-valuenow', v),
})
draw(4)

// Turn it round its centre: 27 degrees is one step.
knob.style.touchAction = 'none'
const angle = (e) => {
  const r = knob.getBoundingClientRect()
  return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI
}
let last = null
knob.addEventListener('pointerdown', (e) => {
  knob.setPointerCapture(e.pointerId)
  last = angle(e)
  scrub.grab()
})
knob.addEventListener('pointermove', (e) => {
  if (last === null) return
  const now = angle(e)
  const turn = ((now - last + 540) % 360) - 180
  last = now
  scrub.drag(turn / 27)
})
const letGo = () => {
  if (last === null) return
  last = null
  scrub.release()
}
knob.addEventListener('pointerup', letGo)
knob.addEventListener('pointercancel', letGo)
knob.addEventListener('keydown', (e) => {
  const v = stepKey(e.key, scrub.target, { min: 0, max: 10, step: 1 })
  if (v === null) return
  e.preventDefault()
  scrub.go(v)
})
