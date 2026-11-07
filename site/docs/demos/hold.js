import { detentHold } from '@hlmnhkl/detent'

const button = document.querySelector('#hold-button')
const out = document.querySelector('#hold-out')

// Hold for 1.5 s to confirm. A tap, Enter or Space never confirms by itself.
const hold = detentHold(button, {
  cssVar: '--progress',
  haptics: true,
  onTap: () => (out.textContent = 'A tap. Here your app shows a confirm step.'),
  onCancel: () => (out.textContent = 'Let go early, so nothing happened.'),
  onConfirm: () => {
    out.textContent = 'Confirmed.'
    setTimeout(() => {
      hold.reset()
      out.textContent = 'Ready again.'
    }, 2400)
  },
})
