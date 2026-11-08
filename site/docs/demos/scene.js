import { detentScroll, scrollScene, timeline } from '@hlmnhkl/detent'

const box = document.querySelector('#sc-box')
const [bar, ...rows] = box.children
const out = document.querySelector('#sc-out')
const toggle = document.querySelector('#sc-settle')
const rise = { from: { y: 12, opacity: 0 }, to: { y: 0, opacity: 1 }, duration: 300, ease: 'out' }

// One label per row. The scroll is the clock: scroll back and it plays back.
const tl = timeline({ paused: true }).label('start')
rows.forEach((row, i) => tl.add(row, rise).add(bar, { to: { '--p': (i + 1) / rows.length }, duration: 300 }, '<').label(`row ${i + 1}`))

const scene = scrollScene(tl, {
  target: document.querySelector('#sc-stage'),
  start: 'top 30%',
  end: 'bottom 70%',
  onUpdate: (p) => (out.textContent = `${Math.round(p * 100)}% through the scene`),
})

// Optional: when the wheel or finger stops, the page settles on a row.
let settle = null
toggle.addEventListener('click', () => {
  settle = settle ? (settle.destroy(), null) : detentScroll({ marks: scene.marks })
  toggle.setAttribute('aria-pressed', String(!!settle))
})
