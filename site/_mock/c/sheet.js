import { detent } from '@hlmnhkl/detent'

const page = document.querySelector('#c-sheet')
const handle = page.querySelector('.c-handle')
const heights = [0.22, 0.55, 0.9]

// A sheet of words that rests at three heights. Pull the first line, or tap it.
const sheet = detent(handle, {
  min: 0.22,
  max: 0.9,
  step: 0.01,
  marks: heights,
  snap: 'marks',
  path: 'y',
  size: () => page.clientHeight,
  text: (h) => ['peek', 'half', 'full'][heights.indexOf(h)],
  onInput: (h) => page.style.setProperty('--h', h),
  onTap: (h) => sheet.go(heights[(heights.indexOf(h) + 1) % 3]),
})
