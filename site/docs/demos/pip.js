import { detent2d } from '@hlmnhkl/detent'

const stage = document.querySelector('#pip-stage')
const video = document.querySelector('#pip')
const out = document.querySelector('#pip-out')

// Throw it toward a corner. Arrow keys move it to the next corner that way.
detent2d(video, {
  points: 'corners',
  bounds: stage,
  inset: 12,
  cssVar: ['--x', '--y'],
  onChange: (i, point) => (out.textContent = point.name),
})
