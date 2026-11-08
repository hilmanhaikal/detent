import { animate } from '@hlmnhkl/detent'

const button = document.querySelector('#an-go')
const card = document.querySelector('#an-card')
const out = document.querySelector('#an-out')
let shown = false

// Start hidden, placed at once.
animate(card, { to: { y: 24, opacity: 0 }, motion: 'reduce' })

// Press again while it moves: it turns round from where it is, at the speed it has.
button.addEventListener('click', () => {
  shown = !shown
  button.setAttribute('aria-pressed', String(shown))
  card.inert = !shown
  animate(card, {
    to: shown ? { y: 0, opacity: 1 } : { y: 24, opacity: 0 },
    onDone: () => (out.textContent = shown ? 'Landed: shown.' : 'Landed: hidden.'),
  })
})
