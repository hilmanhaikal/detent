import { detent } from '@hlmnhkl/detent'

const track = document.querySelector('#first')

detent(track, {
  min: 0, max: 100, step: 10,
  marks: [0, { at: 50, strong: true }, 100],
  cssVar: '--value',
})
