import { detentThrow, follow } from '@hlmnhkl/detent'
import { still } from './ring.js'
import { onSettings } from './settings.js'

const deck = document.querySelector('#deck')
const out = document.querySelector('#deck-out')
const say = (t) => (out.textContent = t)
const lines = ['No bounce.', 'Magnetic marks.', 'Keys work.', 'Motion you can turn off.', 'Tiny.']

const cards = lines.map((line, i) => {
  const el = document.createElement('div')
  el.className = 'card'
  el.setAttribute('aria-label', `Card ${i + 1} of ${lines.length}: ${line}`)
  el.innerHTML = `<span class="c-n">${i + 1} of ${lines.length}</span><span class="c-word">${line}</span>`
  el.style.zIndex = String(lines.length - i)
  el.style.setProperty('--d', i)
  deck.appendChild(el)
  return el
})

let top = 0
const depth = follow({ value: 0, time: () => (still.matches ? 0 : 300), onFrame: (s) => cards.forEach((c, i) => c.style.setProperty('--d', Math.max(0, i - s).toFixed(3))) })
const layer = () => {
  cards.forEach((c, i) => c.toggleAttribute('inert', i !== top))
  depth.set(top)
}

// show
const throws = cards.map((card) =>
  detentThrow(card, {
    cssVar: ['--x', '--y', '--tilt'],
    haptics: true,
    onInput: (x, y, near) => card.style.setProperty('--near', near),
    onThrow: (way) => next(way),
  }),
)
// end

function next(way) {
  top++
  layer()
  say(top < cards.length ? `Thrown ${way}. ${cards.length - top} left.` : `Thrown ${way}. That was the last one. Undo brings them back.`)
}
document.querySelector('#throw-left').addEventListener('click', () => top < cards.length && throws[top].throw('left'))
document.querySelector('#throw-right').addEventListener('click', () => top < cards.length && throws[top].throw('right'))
document.querySelector('#throw-undo').addEventListener('click', () => {
  if (!top) return say('Nothing to undo.')
  top--
  throws[top].undo()
  layer()
  say(`Back in play: card ${top + 1}.`)
})
layer()
onSettings((s) => throws.forEach((t) => t.set({ period: s.period, motion: s.motion })))
