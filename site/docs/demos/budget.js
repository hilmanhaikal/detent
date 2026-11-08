import { animate, frame, frameBudget } from '@hlmnhkl/detent'

const busy = document.querySelector('#fb-busy')
const ball = document.querySelector('#fb-ball')
const out = document.querySelector('#fb-out')
let hog = false

// Stands in for a slow phone: each frame does about 45 ms of other work.
const work = () => {
  const end = performance.now() + 45
  while (performance.now() < end);
  if (hog) frame(work)
}
busy.addEventListener('click', () => {
  hog = !hog
  busy.setAttribute('aria-pressed', String(hog))
  if (hog) frame(work)
})

// A spring back and forth, so you can see it stay on time and land exactly.
let right = false
const swing = () => animate(ball, { to: { x: (right = !right) ? 200 : 0 }, period: 700 }).finished.then(() => setTimeout(swing, 300))
swing()

setInterval(() => (out.textContent = `${frameBudget.frameMs.toFixed(0)} ms a frame, ${frameBudget.low ? 'low: easing off' : 'keeping up'}`), 250)
