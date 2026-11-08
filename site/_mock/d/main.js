import { shown } from './ring.js'
import './geneva.js'
import './mech-cam.js'
import './machine.js'
import './scroll.js'
import { fit } from './grid.js'
import './drive.js'

// Each code block shows the call its drawing runs, cut from the drawing's own file.
const sources = import.meta.glob(['./scroll.js'], { query: '?raw', import: 'default', eager: true })
document.querySelectorAll('pre[data-src]').forEach((pre) => (pre.textContent = shown(sources[`./${pre.dataset.src}`])))

// Code sits open on a wide screen and folds on a phone, so each part fits one screen.
const wide = matchMedia('(min-width: 861px)')
const fold = () => document.querySelectorAll('details.code').forEach((d) => (d.open = wide.matches))
fold()
fit()
wide.addEventListener('change', () => (fold(), fit()))

const say = (t) => {
  const s = document.querySelector('#say')
  s.textContent = ''
  setTimeout(() => (s.textContent = t), 60)
}
document.querySelectorAll('[data-copy]').forEach((b) =>
  b.addEventListener('click', async () => {
    await navigator.clipboard?.writeText(b.dataset.copy).catch(() => {})
    b.toggleAttribute('data-done', true)
    say('Copied to the clipboard.')
    setTimeout(() => b.removeAttribute('data-done'), 1600)
  }),
)
document.querySelectorAll('.copy-code').forEach((b) =>
  b.addEventListener('click', async () => {
    await navigator.clipboard?.writeText(b.previousElementSibling.textContent).catch(() => {})
    b.textContent = 'Copied'
    setTimeout(() => (b.textContent = 'Copy code'), 1600)
  }),
)
