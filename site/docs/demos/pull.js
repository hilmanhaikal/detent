import { detentPull } from '@hlmnhkl/detent'

const box = document.querySelector('#pull-box')
const cue = document.querySelector('#pull-cue')
const out = document.querySelector('#pull-out')

// Pull down past the line and let go. It holds there until done().
const pull = detentPull(box, {
  cssVar: '--pull',
  haptics: true,
  onInput: (distance, near) => box.style.setProperty('--near', near),
  onArm: (armed) => (cue.textContent = armed ? 'Let go to load' : 'Pull down to load'),
  onPull: () => {
    cue.textContent = 'Loading'
    out.textContent = 'Loading.'
    setTimeout(() => {
      pull.done()
      cue.textContent = 'Pull down to load'
      out.textContent = `Loaded at ${new Date().toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}.`
    }, 1200)
  },
})

// The same pull from a button, for keys and screen readers.
document.querySelector('#pull-button').addEventListener('click', () => pull.trigger())
