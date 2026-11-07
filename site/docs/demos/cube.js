import { detent3d } from '@hlmnhkl/detent'

const cube = document.querySelector('#cube')
const out = document.querySelector('#cube-out')

// Six faces. Drag or flick it, and it clicks onto the nearest one. Arrow keys turn it a face at a time.
detent3d(cube, {
  faces: 'cube',
  cssVar: ['--yaw', '--pitch', '--roll'],
  onChange: (i, face) => (out.textContent = face.name),
})
