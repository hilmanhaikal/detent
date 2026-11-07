import { attract, createScrub, nearestMark, roundTo, stepKey, steps, type Mark, type Scrub } from '../../src/index'

const reduced = matchMedia('(prefers-reduced-motion: reduce)')
export const period = () => (reduced.matches ? 0 : 280)

type Pt = { x: number; y: number }

/** Feeds a pointer to a scrub. `delta` turns one pointer move into value units. */
export function hand(el: HTMLElement, scrub: Scrub, delta: (from: Pt, to: Pt) => number, onTap?: () => void) {
  let last: Pt | null = null
  let travel = 0
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    el.setPointerCapture(e.pointerId)
    last = { x: e.clientX, y: e.clientY }
    travel = 0
    el.toggleAttribute('data-held', true)
    scrub.grab()
  })
  el.addEventListener('pointermove', (e) => {
    if (!last) return
    const to = { x: e.clientX, y: e.clientY }
    travel += Math.hypot(to.x - last.x, to.y - last.y)
    const d = delta(last, to)
    last = to
    if (d) scrub.drag(d)
  })
  const end = (e: PointerEvent) => {
    if (!last) return
    last = null
    el.toggleAttribute('data-held', false)
    if (e.type === 'pointercancel') scrub.cancel()
    else if (onTap && travel < 4) onTap()
    else scrub.release()
  }
  el.addEventListener('pointerup', end)
  el.addEventListener('pointercancel', end)
}

/** Turning around the centre of `el`, in degrees. Near the centre the angle is noise, so it reads 0. */
export function turn(el: HTMLElement, a: Pt, b: Pt) {
  const r = el.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  if (Math.hypot(b.x - cx, b.y - cy) < r.width * 0.12) return 0
  let d = Math.atan2(b.y - cy, b.x - cx) - Math.atan2(a.y - cy, a.x - cx)
  if (d > Math.PI) d -= 2 * Math.PI
  if (d < -Math.PI) d += 2 * Math.PI
  return (d * 180) / Math.PI
}

export function keys(el: HTMLElement, scrub: Scrub, pick: (key: string, target: number) => number | null) {
  el.addEventListener('keydown', (e) => {
    const v = pick(e.key, scrub.target)
    if (v === null) return
    e.preventDefault()
    scrub.go(v)
  })
}

export function announce(el: HTMLElement, value: number, text: string) {
  el.setAttribute('aria-valuenow', String(value))
  el.setAttribute('aria-valuetext', text)
}

const moving = (el: HTMLElement) => (m: boolean) => el.toggleAttribute('data-moving', m)

const rm = (n: number) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

// A shop's catalogue, fixed so the count is real: 60 prices from RM 19 to RM 989.
const catalogue = Array.from({ length: 60 }, (_, i) => 19 + ((i * 263) % 971))

/** A shop's price filter: two thumbs on one track. Every RM 50 is a mark; RM 100, 250 and 500 pull harder. */
export function priceRange(host: HTMLElement) {
  const marks: Mark[] = steps(0, 1000, 50).map((at) => ({ at, strong: [100, 250, 500].includes(at) }))
  const magnet = (v: number) => attract(v, marks, 50)
  host.innerHTML = `
    <div class="pr-head"><b>Price</b><span class="pr-range readout"></span></div>
    <div class="pr">
      <div class="pr-rail"><div class="pr-fill"></div></div>
      <div class="pr-ticks" aria-hidden="true">${marks.map((m) => `<i${m.strong ? ' class="strong"' : ''} style="--at:${m.at / 1000}">${m.strong ? `<span>${m.at}</span>` : ''}</i>`).join('')}</div>
      <div class="pr-thumb" role="slider" tabindex="0" aria-label="Lowest price" aria-valuemin="0" aria-valuemax="1000"></div>
      <div class="pr-thumb" role="slider" tabindex="0" aria-label="Highest price" aria-valuemin="0" aria-valuemax="1000"></div>
    </div>
    <p class="pr-count"></p>`
  const box = host.querySelector<HTMLElement>('.pr')!
  const rail = host.querySelector<HTMLElement>('.pr-rail')!
  const [lo, hi] = [...host.querySelectorAll<HTMLElement>('.pr-thumb')]
  const range = host.querySelector('.pr-range')!
  const count = host.querySelector('.pr-count')!
  const at = { lo: 100, hi: 500 }
  const show = () => {
    box.style.setProperty('--lo', String(at.lo / 1000))
    box.style.setProperty('--hi', String(at.hi / 1000))
    const a = Math.round(at.lo / 10) * 10
    const b = Math.round(at.hi / 10) * 10
    range.textContent = `${rm(a)} to ${rm(b)}`
    count.textContent = `${catalogue.filter((p) => p >= a && p <= b).length} of ${catalogue.length} items`
  }
  const make = (el: HTMLElement, key: 'lo' | 'hi', value: number) => {
    const scrub = createScrub({
      value,
      min: key === 'lo' ? 0 : value - 400,
      max: key === 'lo' ? 400 : 1000,
      edge: 10,
      attract: magnet,
      land: (v) => roundTo(magnet(v), 10),
      coast: 0.2,
      period,
      onFrame: (v) => {
        at[key] = v
        show()
      },
      onSettle: (v) => announce(el, v, rm(v)),
      onMoving: moving(el),
    })
    scrub.place(value)
    hand(el, scrub, (a, b) => ((b.x - a.x) / rail.clientWidth) * 1000)
    keys(el, scrub, (k, v) => stepKey(k, v, { min: key === 'lo' ? 0 : at.lo + 50, max: key === 'lo' ? at.hi - 50 : 1000, step: 10, marks: [100, 250, 500] }))
    return scrub
  }
  const a = make(lo, 'lo', 100)
  const b = make(hi, 'hi', 500)
  // The thumbs never cross: each one's end is the other's resting place, less RM 50.
  a.update({ onSettle: (v) => (announce(lo, v, rm(v)), b.update({ min: v + 50 })) })
  b.update({ onSettle: (v) => (announce(hi, v, rm(v)), a.update({ max: v - 50 })) })
  a.update({ max: 450 })
  b.update({ min: 150 })
}

/** A tip dial on a RM 48 bill: 0 to 25 percent, one click per percent, 10, 15 and 20 pull harder. */
export function tipDial(host: HTMLElement) {
  const bill = 48
  const marks: Mark[] = steps(0, 25, 1).map((at) => ({ at, strong: [10, 15, 20].includes(at) }))
  const magnet = (v: number) => attract(v, marks, 1, { reach: 0.3, strong: 1.4 })
  const DEG = 270 / 25
  host.innerHTML = `
    <div class="td" role="slider" tabindex="0" aria-label="Tip" aria-valuemin="0" aria-valuemax="25">
      <div class="td-ticks" aria-hidden="true">${marks.map((m) => `<i${m.strong ? ' class="strong"' : ''} style="--at:${m.at}">${m.strong ? `<span>${m.at}</span>` : ''}</i>`).join('')}</div>
      <div class="td-cap" aria-hidden="true"><b></b></div>
      <div class="td-read" aria-hidden="true"><span class="td-pct readout"></span><span class="td-sum"></span></div>
    </div>
    <p class="td-bill">Bill ${rm(bill)}</p>`
  const el = host.querySelector<HTMLElement>('.td')!
  const pct = host.querySelector('.td-pct')!
  const sum = host.querySelector('.td-sum')!
  const words = (v: number) => `${v} percent, ${rm(bill * v / 100)}`
  const scrub = createScrub({
    value: 10,
    min: 0,
    max: 25,
    edge: 0.6,
    attract: magnet,
    land: (v) => Math.round(magnet(v)),
    period,
    onFrame: (v) => el.style.setProperty('--turn', `${v * DEG - 135}deg`),
    onMark: (v) => {
      pct.textContent = `${v}%`
      sum.textContent = `${rm(bill * v / 100)} tip`
    },
    onSettle: (v) => announce(el, v, words(v)),
    onMoving: moving(el),
  })
  scrub.place(10)
  pct.textContent = '10%'
  sum.textContent = `${rm(4.8)} tip`
  hand(el, scrub, (a, b) => turn(el, a, b) / DEG)
  keys(el, scrub, (k, v) => stepKey(k, v, { min: 0, max: 25, step: 1, marks: [0, 10, 15, 20, 25] }))
}

/** A booking time picker: 08:00 to 21:00 in quarter hours. Whole hours pull harder. */
export function timePicker(host: HTMLElement) {
  const N = 53
  const label = (i: number) => {
    const m = 8 * 60 + Math.round(i) * 15
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  }
  const marks: Mark[] = steps(0, N - 1, 1).map((at) => ({ at, strong: at % 4 === 0 }))
  const magnet = (v: number) => attract(v, marks, 1, { reach: 0.3, strong: 0.7 })
  host.innerHTML = `
    <div class="tp-head"><b>Book a table</b><span>Saturday, party of 2</span></div>
    <div class="wh" role="spinbutton" tabindex="0" aria-label="Booking time" aria-valuemin="0" aria-valuemax="${N - 1}">
      <div class="wh-rows" aria-hidden="true">${'<span></span>'.repeat(9)}</div>
      <div class="wh-lens" aria-hidden="true"></div>
    </div>`
  const el = host.querySelector<HTMLElement>('.wh')!
  const rows = [...host.querySelectorAll<HTMLElement>('.wh-rows span')]
  const row = () => parseFloat(getComputedStyle(el).getPropertyValue('--row')) || 44
  const start = 46
  const scrub = createScrub({
    value: start,
    min: 0,
    max: N - 1,
    edge: 0.8,
    attract: magnet,
    land: (v) => Math.round(magnet(v)),
    coast: 0.3,
    maxSpeed: 40,
    period,
    onFrame: (at) => {
      const base = Math.round(at)
      rows.forEach((r, k) => {
        const i = base + k - 4
        const y = i - at
        const live = i >= 0 && i < N
        r.textContent = live ? label(i) : ''
        // One face for every row: nearness to the band sets the weight and size, a whole hour adds a little.
        const near = Math.max(0, 1 - Math.abs(y))
        r.style.setProperty('--y', y.toFixed(3))
        r.style.setProperty('--o', Math.max(0, 1 - Math.abs(y) / 3.6).toFixed(3))
        r.style.setProperty('--w', String(Math.round(400 + near * 300 + (live && i % 4 === 0 ? 40 : 0))))
        r.style.setProperty('--s', (1 + near * 0.22).toFixed(3))
      })
    },
    onSettle: (v) => announce(el, v, label(v)),
    onMoving: moving(el),
  })
  scrub.place(start)
  hand(el, scrub, (a, b) => -(b.y - a.y) / row())
  keys(el, scrub, (k, v) => stepKey(k, v, { min: 0, max: N - 1, step: 1, marks: marks.filter((m) => m.strong).map((m) => m.at) }))
  el.addEventListener(
    'wheel',
    (e) => {
      // Only a focused picker takes the mouse wheel, so scrolling past it still scrolls the page.
      if (document.activeElement !== el) return
      e.preventDefault()
      scrub.go(Math.min(N - 1, Math.max(0, Math.round(scrub.target) + Math.sign(e.deltaY))))
    },
    { passive: false },
  )
}

/** A delivery app's order sheet: it rests at peek, half or full. Tap the handle to step up. */
export function deliverySheet(host: HTMLElement) {
  const heights = [0.24, 0.56, 0.92]
  const names = ['peek', 'half', 'full']
  host.innerHTML = `
    <div class="sh-frame">
      <div class="sh-map" aria-hidden="true">${'<i></i>'.repeat(12)}<b></b></div>
      <div class="sh">
        <div class="sh-handle" role="slider" tabindex="0" aria-label="Order sheet height" aria-valuemin="0" aria-valuemax="2"><b></b></div>
        <p class="sh-title">Your rider is 6 min away</p>
        <p class="sh-name">Order on the way. Sheet at <span class="sh-h">peek</span>.</p>
        <ul class="sh-items">
          <li><span>2 × Chicken rice</span><span>RM 21.80</span></li>
          <li><span>1 × Iced lemon tea</span><span>RM 4.50</span></li>
          <li><span>Delivery</span><span>RM 3.00</span></li>
          <li class="total"><span>Total</span><span>RM 29.30</span></li>
        </ul>
      </div>
    </div>`
  const frame = host.querySelector<HTMLElement>('.sh-frame')!
  const handle = host.querySelector<HTMLElement>('.sh-handle')!
  const name = host.querySelector('.sh-h')!
  const index = (v: number) => heights.indexOf(v)
  const scrub = createScrub({
    value: heights[0],
    min: heights[0],
    max: heights[2],
    edge: 0.05,
    land: (v) => nearestMark(v, heights)!,
    coast: 0.25,
    period,
    onFrame: (v) => frame.style.setProperty('--h', v.toFixed(4)),
    onMark: (v) => (name.textContent = names[index(v)]),
    onSettle: (v) => announce(handle, index(v), names[index(v)]),
    onMoving: moving(frame),
  })
  scrub.place(heights[0])
  const up = { ArrowUp: 'PageUp', ArrowRight: 'PageUp', ArrowDown: 'PageDown', ArrowLeft: 'PageDown' } as Record<string, string>
  hand(
    handle,
    scrub,
    (a, b) => -(b.y - a.y) / frame.clientHeight,
    () => scrub.go(heights[(index(scrub.target) + 1) % heights.length]),
  )
  keys(handle, scrub, (k, v) => stepKey(up[k] ?? k, v, { min: heights[0], max: heights[2], step: 0.01, marks: heights }))
}

/** The small code shown beside each demo: the same setup as above, cut to the lines that matter. */
export const code: Record<string, string> = {
  price: `const marks = steps(0, 1000, 50).map((at) => ({
  at, strong: [100, 250, 500].includes(at),
}))
const magnet = (v) => attract(v, marks, 50)

createScrub({
  value: 100, min: 0, max: 450,
  attract: magnet,
  land: (v) => roundTo(magnet(v), 10),
  period,
  onFrame: (v) => (thumb.style.left = v / 10 + '%'),
})`,
  tip: `const marks = steps(0, 25, 1).map((at) => ({
  at, strong: [10, 15, 20].includes(at),
}))
const magnet = (v) => attract(v, marks, 1, { strong: 1.4 })

createScrub({
  value: 10, min: 0, max: 25,
  attract: magnet,
  land: (v) => Math.round(magnet(v)),
  period,
  onFrame: (v) => (dial.style.rotate = v * 10.8 - 135 + 'deg'),
})`,
  time: `// 08:00 to 21:00 in quarter hours. Whole hours are strong.
createScrub({
  value: 46, min: 0, max: 52,
  attract: (v) => attract(v, marks, 1, { strong: 0.7 }),
  land: (v) => Math.round(attract(v, marks, 1, { strong: 0.7 })),
  coast: 0.3,
  maxSpeed: 40,
  period,
  onFrame: (at) => drawRows(at),
})`,
  sheet: `const heights = [0.24, 0.56, 0.92]

createScrub({
  value: 0.24, min: 0.24, max: 0.92,
  land: (v) => nearestMark(v, heights),
  coast: 0.25,
  period,
  onFrame: (h) => (sheet.style.translate = \`0 \${(1 - h) * 100}%\`),
})`,
}

export function fillCode(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-code]').forEach((pre) => (pre.textContent = code[pre.dataset.code!]))
}

export function mountDemos(root: ParentNode = document) {
  const make = { price: priceRange, tip: tipDial, time: timePicker, sheet: deliverySheet } as Record<string, (h: HTMLElement) => unknown>
  root.querySelectorAll<HTMLElement>('[data-demo]').forEach((h) => make[h.dataset.demo!](h))
  fillCode(root)
}

export function copyButtons(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((b) => {
    const label = b.innerHTML
    b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy!)
        b.textContent = 'Copied'
      } catch {
        b.textContent = 'Copy failed'
      }
      setTimeout(() => (b.innerHTML = label), 1600)
    })
  })
}
