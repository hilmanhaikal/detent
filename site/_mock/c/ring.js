import { detent } from '@hlmnhkl/detent'

const ring = document.querySelector('#c-ring')
const digits = ring.querySelector('.c-digits')
const now = ring.querySelector('.c-now')
digits.innerHTML = Array.from({ length: 26 }, (_, i) => `<span style="--i:${i}">${i}</span>`).join('')

// A ring of numbers you turn. 10, 15 and 20 pull harder, like the usual tips.
detent(ring, {
  min: 0,
  max: 25,
  value: 15,
  path: 'turn',
  sweep: 270,
  marks: [10, 15, 20].map((at) => ({ at, strong: true })),
  text: (v) => `${v} percent tip`,
  cssVar: '--turn',
  onInput: (v) => (now.textContent = `${Math.round(v)}%`),
})
