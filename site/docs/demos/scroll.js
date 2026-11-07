import { detentScroll } from '@hlmnhkl/detent'

const button = document.querySelector('#settle-toggle')
const out = document.querySelector('#settle-out')
let page = null

// Turned on, this docs page settles onto its sections when your wheel or finger stops.
button.addEventListener('click', () => {
  if (page) {
    page.destroy()
    page = null
  } else {
    page = detentScroll({
      offset: document.querySelector('header'),
      onInput: (y, to) => (out.textContent = `Gliding: ${Math.round(y)} px to ${Math.round(to)} px`),
      onChange: (i, section) => (out.textContent = `Resting on: ${section.querySelector('h1, h2').textContent}`),
    })
  }
  button.setAttribute('aria-pressed', String(!!page))
  out.textContent = page ? 'On. Scroll a little, then let go.' : 'Off. The page scrolls as usual.'
})
