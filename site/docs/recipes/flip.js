import { detent3d } from '@hlmnhkl/detent'

const frame = document.querySelector('#r-flip')

// Two faces on one axis: drag it over, or press Flip. A screen reader hears which side is up.
const card = detent3d(frame, {
  faces: [
    { yaw: 0, name: 'Word: ephemeral' },
    { yaw: 180, name: 'Meaning: lasting a very short time' },
  ],
  axes: 'yaw',
  cssVar: ['--yaw', '--pitch'],
})

document.querySelector('#r-flip-button').addEventListener('click', () => card.go(1 - card.index))
