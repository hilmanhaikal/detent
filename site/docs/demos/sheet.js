import { detent } from '@hlmnhkl/detent'

const frame = document.querySelector('#demo-sheet')
const handle = frame.querySelector('.d-handle')
const names = { 0.24: 'peek', 0.56: 'half', 0.92: 'full' }
const heights = [0.24, 0.56, 0.92]

// It rests only at its heights. A tap steps it up.
const sheet = detent(handle, {
  min: 0.24,
  max: 0.92,
  step: 0.01,
  marks: heights,
  snap: 'marks',
  path: 'y',
  size: () => frame.clientHeight,
  text: (h) => names[h],
  onInput: (h) => frame.style.setProperty('--h', h),
  onTap: (h) => sheet.go(heights[(heights.indexOf(h) + 1) % 3]),
})
