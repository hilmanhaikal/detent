import { detent } from '@hlmnhkl/detent'

const wheel = document.querySelector('#r-time')
const rows = [...wheel.querySelectorAll('span')]
// Slot 0 is 08:00, slot 52 is 21:00, a quarter hour each. Whole hours are strong.
const time = (i) => {
  const m = 480 + Math.round(i) * 15
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

detent(wheel, {
  min: 0,
  max: 52,
  value: 46,
  marks: Array.from({ length: 14 }, (_, h) => ({ at: h * 4, strong: true })),
  path: 'y',
  size: 44,
  coast: 0.3,
  text: time,
  onInput: (at) =>
    rows.forEach((row, k) => {
      const i = Math.round(at) + k - 3
      row.textContent = i >= 0 && i <= 52 ? time(i) : ''
      row.style.setProperty('--y', String(i - at))
    }),
})
