export type Pt = { x: number; y: number }

export type Hand = {
  grab: (at: Pt) => void
  move: (from: Pt, to: Pt) => void
  /** A tap is a press that moved less than 4px. */
  end: (how: 'release' | 'cancel' | 'tap') => void
}

export type HandOptions = {
  /** Turns some pointers away. */
  only?: (e: PointerEvent) => boolean
  /** Holds the pointer only once it moves, so a tap still clicks a button inside. */
  late?: boolean
}

/** Feeds one pointer at a time on `el` to `on`, until `signal` aborts. */
export function hand(el: HTMLElement, on: Hand, signal: AbortSignal, touchAction: string, { only, late }: HandOptions = {}) {
  // Without this the browser takes the finger for a page scroll. A value set in CSS wins.
  if (touchAction && getComputedStyle(el).touchAction === 'auto') {
    el.style.touchAction = touchAction
    signal.addEventListener('abort', () => (el.style.touchAction = ''))
  }
  let last: Pt | null = null
  let id = -1
  let travel = 0
  const opts = { signal }
  el.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || last || (only && !only(e))) return
      id = e.pointerId
      if (!late) el.setPointerCapture(id)
      last = { x: e.clientX, y: e.clientY }
      travel = 0
      el.toggleAttribute('data-held', true)
      on.grab(last)
    },
    opts,
  )
  el.addEventListener(
    'pointermove',
    (e) => {
      if (!last || e.pointerId !== id) return
      const to = { x: e.clientX, y: e.clientY }
      travel += Math.hypot(to.x - last.x, to.y - last.y)
      if (late && travel >= 4 && !el.hasPointerCapture(id)) {
        try {
          el.setPointerCapture(id)
        } catch {
          // A pointer the browser has let go of cannot be held, and needs no holding.
        }
      }
      on.move(last, to)
      last = to
    },
    opts,
  )
  const end = (e: PointerEvent) => {
    if (!last || e.pointerId !== id) return
    last = null
    el.toggleAttribute('data-held', false)
    on.end(e.type === 'pointercancel' ? 'cancel' : travel < 4 ? 'tap' : 'release')
  }
  el.addEventListener('pointerup', end, opts)
  el.addEventListener('pointercancel', end, opts)
  el.addEventListener('dragstart', (e) => e.preventDefault(), opts)
  signal.addEventListener('abort', () => el.removeAttribute('data-held'))
}

/** How far the hand turned around the centre of `el`, in degrees. Near the centre the angle is noise, so it reads 0. */
export function turned(el: HTMLElement, a: Pt, b: Pt) {
  const r = el.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  if (Math.hypot(b.x - cx, b.y - cy) < r.width * 0.12) return 0
  let d = Math.atan2(b.y - cy, b.x - cx) - Math.atan2(a.y - cy, a.x - cx)
  if (d > Math.PI) d -= 2 * Math.PI
  if (d < -Math.PI) d += 2 * Math.PI
  return (d * 180) / Math.PI
}
