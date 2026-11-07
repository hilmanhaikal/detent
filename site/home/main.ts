import { attract, createScrub, pull, roundTo, stepKey, steps, wheelSteps, type Mark } from '../../src/index'
import { announce, copyButtons, hand, keys, mountDemos, period } from '../shared/controls'
import './header'
import { pageSettle } from './settle'
import startCode from './start.js?raw'
import './start.js'

// A ruler from 0 to 100. Every 5 is a numeral it can land on, and every 25 is strong.
const marks: Mark[] = steps(0, 100, 5).map((at) => ({ at, strong: at % 25 === 0 }))
const reach = { reach: 0.45, strong: 1.2 }
const magnet = (v: number) => attract(v, marks, 5, reach)

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

const scrub = createScrub({
  value: 50,
  min: 0,
  max: 100,
  edge: 4,
  attract: magnet,
  land: (v) => roundTo(magnet(v), 5),
  coast: 0.25,
  maxSpeed: 140,
  period,
  onFrame: (v) => {
    ruler.style.setProperty('--v', v.toFixed(3))
    nums.forEach((n, i) => n.style.setProperty('--p', pull(v - marks[i].at, feel(marks[i])).toFixed(3)))
  },
  // A short flash on the pin each time a new number comes under it: the click you would feel.
  onMark: () => {
    pin.removeAttribute('data-click')
    void pin.offsetWidth
    pin.setAttribute('data-click', '')
  },
  onSettle: (v) => announce(ruler, v, String(v)),
  onMoving: (m) => ruler.toggleAttribute('data-moving', m),
})
scrub.place(50)

const unit = () => parseFloat(getComputedStyle(ruler).getPropertyValue('--unit')) || 20
hand(ruler, scrub, (a, b) => -(b.x - a.x) / unit())
keys(ruler, scrub, (k, v) => stepKey(k, v, { min: 0, max: 100, step: 5, marks: [0, 25, 50, 75, 100] }))

// A sideways trackpad swipe moves it too. Up and down stay with the page.
const wheel = wheelSteps()
ruler.addEventListener(
  'wheel',
  (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
    e.preventDefault()
    const n = wheel(e.deltaX, 40)
    if (n) scrub.go(Math.min(100, Math.max(0, scrub.target + n * 5)))
  },
  { passive: false },
)

pageSettle()

document.querySelector('[data-start]')!.textContent = startCode.trim()
mountDemos()
copyButtons()
