import { detent } from '@hlmnhkl/detent'

const frame = document.querySelector('#r-sheet')
const handle = frame.querySelector('.d-handle')
const heights = [0.24, 0.56, 0.92]

// An order sheet: peek, half or full, never in between. Tap the handle to step up.
const sheet = detent(handle, {
  min: 0.24,
  max: 0.92,
  step: 0.01,
  marks: heights,
  snap: 'marks',
  path: 'y',
  size: () => frame.clientHeight,
  coast: 0.25,
  text: (h) => ['Order, peek', 'Order, half', 'Order, full'][heights.indexOf(h)],
  onInput: (h) => frame.style.setProperty('--h', h),
  onTap: (h) => sheet.go(heights[(heights.indexOf(h) + 1) % 3]),
})
