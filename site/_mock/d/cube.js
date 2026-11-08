import { detent3d } from '@hlmnhkl/detent'
import { onSettings } from './settings.js'

const el = document.querySelector('#cube')
const cube = el.querySelector('.cube')
const out = document.querySelector('#cube-out')
const sides = ['front', 'right', 'back', 'left', 'top', 'bottom']
const word = 'detent'
sides.forEach((side, i) => {
  const f = document.createElement('div')
  f.className = `face f-${side}`
  f.setAttribute('aria-hidden', 'true')
  f.innerHTML = `<b>${word[i]}</b><span>${side}</span><em>${i + 1}</em>`
  cube.appendChild(f)
})

// show
const turn = detent3d(el, {
  faces: 'cube',
  names: [...word].map((ch, i) => `${ch}, face ${i + 1}`),
  cssVar: ['--yaw', '--pitch', '--roll'],
  onChange: (i) => land(i),
})
// end

function land(i) {
  cube.querySelectorAll('.face').forEach((f, k) => f.classList.toggle('landed', k === i))
  out.textContent = `${word.slice(0, i)}[${word[i]}]${word.slice(i + 1)}`
}
land(turn.index)
onSettings((s) => turn.set({ coast: s.coast, period: s.period + 40, motion: s.motion }))
