import { detent, steps, type Detent, type Mark } from '@hlmnhkl/detent'

const rm = (n: number) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

// A shop's catalogue, fixed so the count is real: 60 prices from RM 19 to RM 989.
const catalogue = Array.from({ length: 60 }, (_, i) => 19 + ((i * 263) % 971))

/** A shop's price filter: two thumbs on one track. Every RM 50 is a mark; RM 100, 250 and 500 pull harder. */
export function priceRange(host: HTMLElement) {
  const marks: Mark[] = steps(0, 1000, 50).map((at) => ({ at, strong: [100, 250, 500].includes(at) }))
  host.innerHTML = `
    <div class="pr-head"><b>Price</b><span class="pr-range readout"></span></div>
    <div class="pr">
      <div class="pr-rail"><div class="pr-fill"></div></div>
      <div class="pr-ticks" aria-hidden="true">${marks.map((m) => `<i${m.strong ? ' class="strong"' : ''} style="--at:${m.at / 1000}">${m.strong ? `<span>${m.at}</span>` : ''}</i>`).join('')}</div>
      <div class="pr-thumb" aria-label="Lowest price"></div>
      <div class="pr-thumb" aria-label="Highest price"></div>
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
  const thumb = (el: HTMLElement, key: 'lo' | 'hi', min: number, max: number) =>
    detent(el, {
      value: at[key],
      min,
      max,
      step: 10,
      marks,
      edge: 10,
      size: () => rail.clientWidth / 1000,
      text: rm,
      onInput: (v) => {
        at[key] = v
        show()
      },
    })
  // The thumbs never cross: each one's end is the other's resting place, less RM 50.
  const a = thumb(lo, 'lo', 0, 450)
  const b = thumb(hi, 'hi', 150, 1000)
  a.set({ onChange: (v) => b.set({ min: v + 50 }) })
  b.set({ onChange: (v) => a.set({ max: v - 50 }) })
}

/** A tip dial on a RM 48 bill: 0 to 25 percent, one click per percent, 10, 15 and 20 pull harder. */
export function tipDial(host: HTMLElement) {
  const bill = 48
  const marks: Mark[] = steps(0, 25, 1).map((at) => ({ at, strong: [10, 15, 20].includes(at) }))
  const DEG = 270 / 25
  host.innerHTML = `
    <div class="td" aria-label="Tip">
      <div class="td-ticks" aria-hidden="true">${marks.map((m) => `<i${m.strong ? ' class="strong"' : ''} style="--at:${m.at}">${m.strong ? `<span>${m.at}</span>` : ''}</i>`).join('')}</div>
      <div class="td-cap" aria-hidden="true"><b></b></div>
      <div class="td-read" aria-hidden="true"><span class="td-pct readout"></span><span class="td-sum"></span></div>
    </div>
    <p class="td-bill">Bill ${rm(bill)}</p>`
  const el = host.querySelector<HTMLElement>('.td')!
  const pct = host.querySelector('.td-pct')!
  const sum = host.querySelector('.td-sum')!
  const read = (v: number) => {
    pct.textContent = `${v}%`
    sum.textContent = `${rm((bill * v) / 100)} tip`
  }
  detent(el, {
    value: 10,
    min: 0,
    max: 25,
    path: 'turn',
    marks,
    reach: { reach: 0.3, strong: 1.4 },
    text: (v) => `${v} percent, ${rm((bill * v) / 100)}`,
    onInput: (v) => el.style.setProperty('--turn', `${v * DEG - 135}deg`),
    onMark: read,
  })
  read(10)
}

/** A booking time picker: 08:00 to 21:00 in quarter hours. Whole hours pull harder. */
export function timePicker(host: HTMLElement) {
  const N = 53
  const label = (i: number) => {
    const m = 8 * 60 + Math.round(i) * 15
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  }
  const marks: Mark[] = steps(0, N - 1, 1).map((at) => ({ at, strong: at % 4 === 0 }))
  host.innerHTML = `
    <div class="tp-head"><b>Book a table</b><span>Saturday, party of 2</span></div>
    <div class="wh" role="spinbutton" aria-label="Booking time">
      <div class="wh-rows" aria-hidden="true">${'<span></span>'.repeat(9)}</div>
      <div class="wh-lens" aria-hidden="true"></div>
    </div>`
  const el = host.querySelector<HTMLElement>('.wh')!
  const rows = [...host.querySelectorAll<HTMLElement>('.wh-rows span')]
  const picker = detent(el, {
    value: 46,
    min: 0,
    max: N - 1,
    path: 'y',
    size: () => parseFloat(getComputedStyle(el).getPropertyValue('--row')) || 44,
    marks,
    reach: { reach: 0.3, strong: 0.7 },
    edge: 0.8,
    coast: 0.3,
    maxSpeed: 40,
    text: label,
    onInput: (at) => {
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
  })
  el.addEventListener(
    'wheel',
    (e) => {
      // Only a focused picker takes the mouse wheel, so scrolling past it still scrolls the page.
      if (document.activeElement !== el) return
      e.preventDefault()
      picker.go(Math.round(picker.value) + Math.sign(e.deltaY))
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
        <div class="sh-handle" aria-label="Order sheet height"><b></b></div>
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
  const sheet: Detent = detent(handle, {
    value: heights[0],
    min: heights[0],
    max: heights[2],
    step: 0.01,
    marks: heights,
    snap: 'marks',
    path: 'y',
    size: () => frame.clientHeight,
    edge: 0.05,
    coast: 0.25,
    text: (v) => names[index(v)],
    onInput: (v) => frame.style.setProperty('--h', v.toFixed(4)),
    onMark: (v) => (name.textContent = names[index(v)]),
    onTap: (v) => sheet.go(heights[(index(v) + 1) % heights.length]),
  })
}

/** The small code shown beside each demo: the same setup as above, cut to the lines that matter. */
export const code: Record<string, string> = {
  price: `const marks = steps(0, 1000, 50).map((at) => ({
  at, strong: [100, 250, 500].includes(at),
}))

detent(thumb, {
  value: 100, min: 0, max: 450, step: 10,
  marks,
  size: () => track.clientWidth / 1000,
  text: (v) => 'RM ' + v,
  onInput: (v) => (thumb.style.left = v / 10 + '%'),
})`,
  tip: `const marks = steps(0, 25, 1).map((at) => ({
  at, strong: [10, 15, 20].includes(at),
}))

detent(dial, {
  value: 10, min: 0, max: 25,
  path: 'turn',
  marks,
  reach: { strong: 1.4 },
  onInput: (v) => (dial.style.rotate = v * 10.8 - 135 + 'deg'),
})`,
  time: `// 08:00 to 21:00 in quarter hours. Whole hours are strong.
detent(wheel, {
  value: 46, min: 0, max: 52,
  path: 'y', size: 44,
  marks,
  reach: { strong: 0.7 },
  coast: 0.3,
  maxSpeed: 40,
  text: (i) => times[i],
  onInput: (at) => drawRows(at),
})`,
  sheet: `const heights = [0.24, 0.56, 0.92]

detent(handle, {
  value: 0.24, min: 0.24, max: 0.92, step: 0.01,
  marks: heights, snap: 'marks',
  path: 'y', size: () => frame.clientHeight,
  coast: 0.25,
  onInput: (h) => (sheet.style.translate = \`0 \${(1 - h) * 100}%\`),
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
