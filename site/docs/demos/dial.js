import { detent } from '@hlmnhkl/detent'

const dial = document.querySelector('#demo-dial')
const cap = dial.querySelector('.d-cap')
const out = document.querySelector('#demo-dial-out')

// 270 degrees of turn from 0 to 25. 10, 15 and 20 pull harder.
detent(dial, {
  min: 0,
  max: 25,
  value: 15,
  path: 'turn',
  sweep: 270,
  marks: [10, 15, 20].map((at) => ({ at, strong: true })),
  text: (v) => `${v} percent tip`,
  onInput: (v) => (cap.style.rotate = `${v * 10.8 - 135}deg`),
  onChange: (v) => (out.textContent = `${v}%`),
})
