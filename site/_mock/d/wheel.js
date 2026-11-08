import { detent } from '@hlmnhkl/detent'
import { frame, writer } from './ring.js'
import { onSettings } from './settings.js'

const wheel = document.querySelector('#wheel')
const box = wheel.querySelector('.wheel-rows')
const set = writer()
const words = ['click', 'glide', 'land', 'rest', 'pull', 'settle', 'hold', 'throw', 'turn', 'drag', 'flick', 'snap']
const SHOW = 7
const rows = Array.from({ length: SHOW }, () => box.appendChild(document.createElement('span')))
const row = () => wheel.clientHeight / 5

let at = 5

// show
const pick = detent(wheel, {
  loop: true,
  count: words.length,
  value: 5,
  path: 'y',
  size: row,
  coast: 0.3,
  text: (i) => words[i],
  onInput: (at) => draw(at),
})
// end

function draw(v) {
  at = v
  frame(paint)
}
function paint() {
  const h = row()
  const base = Math.round(at)
  rows.forEach((el, k) => {
    const i = base + k - 3
    const off = i - at
    el.textContent = words[((i % words.length) + words.length) % words.length]
    // Rows turn away on a drum: further from the middle, more turned and fainter.
    const ang = Math.max(-80, Math.min(80, off * 22))
    set(el, 'transform', `translateY(${(Math.sin((ang * Math.PI) / 180) * h * 2.6).toFixed(1)}px) rotateX(${(-ang).toFixed(2)}deg)`)
    set(el, 'opacity', Math.max(0, Math.cos((ang * Math.PI) / 180) ** 2).toFixed(3))
    el.classList.toggle('on', Math.abs(off) < 0.5)
  })
}
addEventListener('resize', () => frame(paint))
onSettings((s) => pick.set({ coast: s.coast, period: s.period, motion: s.motion }))
