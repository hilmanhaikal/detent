import { detentThrow } from '@hlmnhkl/detent'

const card = document.querySelector('#throw-card')
const out = document.querySelector('#throw-out')

// Drag it past the line or flick it. The buttons do the same for keys and screen readers.
const fling = detentThrow(card, {
  cssVar: ['--x', '--y', '--tilt'],
  haptics: true,
  onInput: (x, y, near) => card.style.setProperty('--near', near),
  onThrow: (way) => (out.textContent = `Thrown ${way}. Undo brings it back.`),
})

document.querySelector('#throw-left').addEventListener('click', () => fling.throw('left'))
document.querySelector('#throw-right').addEventListener('click', () => fling.throw('right'))
document.querySelector('#throw-undo').addEventListener('click', () => {
  fling.undo()
  out.textContent = 'Back in play.'
})
