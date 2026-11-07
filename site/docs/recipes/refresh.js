import { detentPull } from '@hlmnhkl/detent'

const list = document.querySelector('#r-orders')
const rows = list.querySelector('ul')
const said = document.querySelector('#r-orders-said')
let next = 1043

// Pull the list down at its top to check for new orders. The Refresh button does the same.
const refresh = detentPull(list, {
  cssVar: '--pull',
  onInput: (distance, near) => list.style.setProperty('--near', near),
  onArm: (armed) => list.setAttribute('data-cue', armed ? 'Let go to refresh' : 'Pull to refresh'),
  onPull: async () => {
    said.textContent = 'Refreshing orders.'
    await new Promise((done) => setTimeout(done, 1000))
    const row = document.createElement('li')
    row.innerHTML = `<b>Order ${next++}</b><span>Ready for pickup</span>`
    rows.prepend(row)
    refresh.done()
    said.textContent = 'One new order.'
  },
})

document.querySelector('#r-orders-refresh').addEventListener('click', () => refresh.trigger())
