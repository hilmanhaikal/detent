import { detent } from '@hlmnhkl/detent'

const track = document.querySelector('#demo-slider')
const out = document.querySelector('#demo-slider-out')

// Every 10 is a step. 50 is strong, so it pulls from further away.
detent(track, {
  min: 0,
  max: 100,
  step: 10,
  marks: [0, { at: 50, strong: true }, 100],
  cssVar: '--value',
  text: (v) => `${v} percent`,
  onChange: (v) => (out.textContent = `${v}%`),
})
