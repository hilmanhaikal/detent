import { detent2d } from '@hlmnhkl/detent'

const open = document.querySelector('#r-video-open')
const video = document.querySelector('#r-video')
let pip = null

// A floating player that rests in a corner of the screen. Throw it to another one.
open.addEventListener('click', () => {
  video.hidden = !video.hidden
  open.setAttribute('aria-pressed', String(!video.hidden))
  if (video.hidden) return pip.destroy()
  pip = detent2d(video, { points: 'corners', inset: 16, value: 3, cssVar: ['--x', '--y'] })
})
