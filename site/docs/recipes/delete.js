import { detentHold } from '@hlmnhkl/detent'

const box = document.querySelector('#r-delete')
const button = box.querySelector('.r-hold')
const step = box.querySelector('[role="group"]')
const [cancel, confirm] = step.querySelectorAll('button')
const said = box.querySelector('[aria-live]')

let gone = false

const open = (on) => {
  if (gone) return
  step.hidden = !on
  button.setAttribute('aria-expanded', String(on))
  ;(on ? cancel : button).focus()
}
const deleted = () => {
  gone = true
  step.hidden = true
  button.setAttribute('aria-expanded', 'false')
  button.querySelector('span').textContent = 'Address deleted'
  said.textContent = 'Address deleted.'
  setTimeout(() => {
    gone = false
    hold.reset()
    button.querySelector('span').textContent = 'Delete this address'
    said.textContent = ''
  }, 2400)
}

// Hold to delete. A tap opens a confirm step instead, since holding is hard for many people.
const hold = detentHold(button, { cssVar: '--progress', onTap: () => open(true), onConfirm: deleted })

cancel.addEventListener('click', () => open(false))
confirm.addEventListener('click', deleted)
step.addEventListener('keydown', (e) => e.key === 'Escape' && open(false))
