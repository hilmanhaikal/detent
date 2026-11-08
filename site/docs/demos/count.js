import { animate } from '@hlmnhkl/detent'

const button = document.querySelector('#an-add')
const shown = document.querySelector('#an-total')
const said = document.querySelector('#an-said')
const rm = (v) => `RM ${v.toFixed(2)}`
let total = 48
let at = total
let count

// The number counts on screen. A screen reader hears only where it lands.
button.addEventListener('click', () => {
  total += 12.5
  count?.stop()
  count = animate(at, {
    to: total,
    duration: 700,
    onUpdate: (v) => (shown.textContent = rm((at = v))),
    onDone: () => (said.textContent = `Total ${rm(total)}`),
  })
})
