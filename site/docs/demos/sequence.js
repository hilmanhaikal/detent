import { timeline } from '@hlmnhkl/detent'

const card = document.querySelector('#tl-card')
const [tick, title, ...rows] = card.children
const rise = { from: { y: 10, opacity: 0 }, to: { y: 0, opacity: 1 } }

// The words are in the page from the start. The timeline only moves them in.
const tl = timeline({ paused: true })
  .add(card, rise)
  .add(tick, { from: { scale: 0.6, opacity: 0 }, to: { scale: 1, opacity: 1 } }, '-=300')
  .add(title, rise, '<')
for (const row of rows) tl.add(row, { ...rise, period: 300 }, '-=250')

tl.seek(tl.duration)
document.querySelector('#tl-play').addEventListener('click', () => tl.play())
document.querySelector('#tl-back').addEventListener('click', () => tl.reverse())
