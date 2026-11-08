import { detent, wrap } from '@hlmnhkl/detent'

const hours = document.querySelector('#c-hours')
const rows = [...hours.querySelectorAll('span')]
const hour = (h) => `${String(wrap(h, 24)).padStart(2, '0')}:00`

// Round and round, 24 hours. A flick glides, then stops on an hour.
detent(hours, {
  loop: true,
  count: 24,
  value: 7,
  path: 'y',
  size: 56,
  coast: 0.3,
  text: hour,
  onInput: (at) =>
    rows.forEach((row, k) => {
      const i = Math.round(at) + k - 2
      row.textContent = hour(i)
      row.style.setProperty('--y', String(i - at))
    }),
})
