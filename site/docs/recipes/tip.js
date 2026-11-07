import { detent } from '@hlmnhkl/detent'

const dial = document.querySelector('#r-tip')
const cap = dial.querySelector('.d-cap')
const out = document.querySelector('#r-tip-out')
const bill = 48
const rm = (n) => `RM ${n.toFixed(2)}`

// One click per percent, 0 to 25. The common tips, 10, 15 and 20, pull harder.
detent(dial, {
  min: 0,
  max: 25,
  value: 10,
  path: 'turn',
  marks: [10, 15, 20].map((at) => ({ at, strong: true })),
  reach: { reach: 0.3, strong: 1.4 },
  text: (v) => `${v} percent, ${rm((bill * v) / 100)}`,
  onInput: (v) => (cap.style.rotate = `${v * 10.8 - 135}deg`),
  onMark: (v) => (out.textContent = `${v}% tip, ${rm((bill * v) / 100)}. Total ${rm(bill * (1 + v / 100))}`),
})
