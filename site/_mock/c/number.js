import { detent } from '@hlmnhkl/detent'

const number = document.querySelector('#c-number')
const big = number.querySelector('.c-big')

// The number is the slider. Drag it sideways: every 10 is a step, and 50 pulls harder.
detent(number, {
  min: 0,
  max: 100,
  step: 10,
  value: 50,
  marks: [0, { at: 50, strong: true }, 100],
  size: 6,
  cssVar: '--value',
  text: (v) => `${v} percent`,
  onInput: (v) => (big.textContent = Math.round(v)),
})
