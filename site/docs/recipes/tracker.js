import { detent, timeline } from '@hlmnhkl/detent'

const route = document.querySelector('#tl-route')
const stops = [...route.querySelectorAll('li')]
const names = stops.map((li) => li.textContent)

// The parcel moves stop to stop. Each stop is a label, so it is also a mark.
const tl = timeline({ paused: true, onUpdate: (ms) => stops.forEach((li, i) => li.toggleAttribute('data-on', ms >= marks[i].at)) })
tl.label(names[0])
names.slice(1).forEach((name, i) => tl.add(route, { to: { '--p': (i + 1) / (names.length - 1) }, duration: 700, ease: 'inOut' }).label(name))
const marks = tl.marks()

// Drag it, flick it or use the keys: it settles on a stop, never between two.
const scrub = document.querySelector('#tl-scrub')
detent(scrub, {
  min: 0,
  max: tl.duration,
  marks,
  snap: 'marks',
  text: (ms) => names[marks.findIndex((m) => m.at === ms)],
  onInput: (ms) => {
    tl.seek(ms)
    scrub.style.setProperty('--value', (ms / tl.duration) * 100)
  },
})
