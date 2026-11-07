import { detentThrow } from '@hlmnhkl/detent'

const card = document.querySelector('#r-notice')
const toast = document.querySelector('#r-notice-toast')
const undo = toast.querySelector('button')

// Swipe a notification away either way. The Dismiss button does the same.
const notice = detentThrow(card, {
  cssVar: ['--x', '--y', '--tilt'],
  tilt: 0,
  onThrow: () => {
    card.hidden = true
    toast.hidden = false
    undo.focus()
  },
})

card.querySelector('button').addEventListener('click', () => notice.throw('right'))
undo.addEventListener('click', () => {
  card.hidden = false
  toast.hidden = true
  notice.undo()
  card.querySelector('button').focus()
})
