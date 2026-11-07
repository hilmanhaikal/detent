import { detent, pull, steps, wheelSteps, type Mark } from '@hlmnhkl/detent'
import { copyButtons, mountDemos } from '../shared/controls'
import './header'
import { pageSettle } from './settle'
import startCode from './start.js?raw'
import './start.js'

// A ruler from 0 to 100. Every 5 is a numeral it can land on, and every 25 is strong.
const marks: Mark[] = steps(0, 100, 5).map((at) => ({ at, strong: at % 25 === 0 }))
const reach = { reach: 0.45, strong: 1.2 }

const ruler = document.querySelector<HTMLElement>('.ruler')!
const track = ruler.querySelector<HTMLElement>('.track')!
const pin = ruler.querySelector<HTMLElement>('.pin')!
track.innerHTML =
  steps(0, 100, 1)
    .map((i) => `<i class="${i % 25 === 0 ? 'tick strong' : i % 5 === 0 ? 'tick five' : 'tick'}" style="--x:${i}"></i>`)
    .join('') + marks.map((m) => `<span class="num${m.strong ? ' strong' : ''}" style="--x:${m.at}">${m.at}</span>`).join('')
const nums = [...track.querySelectorAll<HTMLElement>('.num')]

// How far a numeral feels the pull: wider than the magnet, so it swells before it catches.
const feel = (m: Mark) => 5 * (m.strong ? reach.strong : reach.reach) * 2.4

const hero = detent(ruler, {
  value: 50,
  min: 0,
  max: 100,
  step: 5,
  marks,
  reach,
  edge: 4,
  coast: 0.25,
  maxSpeed: 140,
  // The track moves under a fixed pin, so a drag to the right lowers the number.
  invert: true,
  size: () => parseFloat(getComputedStyle(ruler).getPropertyValue('--unit')) || 20,
  cssVar: '--v',
  onInput: (v) => nums.forEach((n, i) => n.style.setProperty('--p', pull(v - marks[i].at, feel(marks[i])).toFixed(3))),
  // A short flash on the pin each time a new number comes under it: the click you would feel.
  onMark: () => {
    pin.removeAttribute('data-click')
    void pin.offsetWidth
    pin.setAttribute('data-click', '')
  },
})

// A sideways trackpad swipe moves it too. Up and down stay with the page.
const wheel = wheelSteps()
ruler.addEventListener(
  'wheel',
  (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
    e.preventDefault()
    const n = wheel(e.deltaX, 40)
    if (n) hero.go(hero.value + n * 5)
  },
  { passive: false },
)

pageSettle()

document.querySelector('[data-start]')!.textContent = startCode.trim()
mountDemos()
copyButtons()
