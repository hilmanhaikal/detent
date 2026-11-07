import { detent, wrap } from '@hlmnhkl/detent'

const wheel = document.querySelector('#demo-wheel')
const rows = [...wheel.querySelectorAll('span')]
const hour = (h) => `${String(wrap(h, 24)).padStart(2, '0')}:00`

// Round and round: 24 hours, each row 44px tall. A flick glides, then stops on an hour.
detent(wheel, {
  loop: true,
  count: 24,
  value: 7,
  path: 'y',
  size: 44,
  coast: 0.3,
  text: hour,
  onInput: (at) =>
    rows.forEach((row, k) => {
      const i = Math.round(at) + k - 3
      row.textContent = hour(i)
      row.style.setProperty('--y', String(i - at))
    }),
})
