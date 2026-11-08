import { detent } from '@hlmnhkl/detent'
import { frame } from './ring.js'

const tape = document.querySelector('#tape')
const track = tape.querySelector('.tape-track')
const now = document.querySelector('.tape-now')
const PX = 14
for (let v = 0; v <= 200; v++) {
  const b = document.createElement('b')
  b.className = v % 50 === 0 ? 'fifty' : v % 10 === 0 ? 'ten' : v % 5 === 0 ? 'five' : ''
  b.style.left = `${v * PX}px`
  b.innerHTML = v % 10 === 0 ? `<i></i><span>${v}</span>` : '<i></i>'
  track.appendChild(b)
}

let at = 120

// show
detent(tape, {
  min: 0,
  max: 200,
  value: 120,
  invert: true,
  size: 14,
  coast: 0.35,
  text: (v) => `${v} centimetres`,
  onInput: (at) => draw(at),
})
// end

function draw(v) {
  at = v
  frame(paint)
}
function paint() {
  track.style.transform = `translateX(${(-at * PX).toFixed(1)}px)`
  now.textContent = Math.round(at)
}
