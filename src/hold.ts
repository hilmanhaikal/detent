import { frame } from './frame.js'
import { hand } from './hand.js'
import { haptics, type Haptics } from './haptics.js'
import { reduced, type Motion } from './motion.js'

export type HoldEventMap = {
  /** Every frame while it fills or rewinds: progress from 0 to 1. */
  'detenthold:input': CustomEvent<{ progress: number }>
  /** A quick press, a single Enter or Space, or a screen reader click. Show a confirm step. */
  'detenthold:tap': CustomEvent<Record<string, never>>
  /** Once, when a hold runs to the end. */
  'detenthold:confirm': CustomEvent<Record<string, never>>
  /** A hold let go, moved off or cut short before the end. */
  'detenthold:cancel': CustomEvent<Record<string, never>>
}

declare global {
  interface HTMLElementEventMap extends HoldEventMap {}
}

export type HoldOptions = {
  /** How long the hold takes, in ms. It fills at an even speed: it is a clock. Default 1500. */
  time?: number
  /** How long an early let-go takes to run back to 0, in ms. Default 140. */
  rewind?: number
  /** A press shorter than this, in ms, is a tap. Default 250. */
  tap?: number
  /** A finger that slides this far off the element, in px, lets go. Default 16. */
  leave?: number
  /** Default 'auto': follows prefers-reduced-motion, live. Under reduce the clock still runs, and the rewind jumps. */
  motion?: Motion
  /** A CSS custom property that gets the progress, 0 to 1, on each frame. Off unless you name one. */
  cssVar?: `--${string}`
  /** A short tick on phones that vibrate, when the hold completes. Default false. */
  haptics?: Haptics
  /** Aborting it is the same as destroy(). */
  signal?: AbortSignal
  /** Every frame while it fills or rewinds, and once at the start: progress from 0 to 1. */
  onInput?: (progress: number) => void
  /** A quick press, a single Enter or Space, or a screen reader click. It never confirms by itself: show a confirm step. */
  onTap?: () => void
  /** Once, when a hold runs to the end. It stays done until reset(). */
  onConfirm?: () => void
  /** A hold let go, moved off or cut short before the end. */
  onCancel?: () => void
}

export type Hold = {
  /** How full it is now, 0 to 1. */
  readonly progress: number
  /** True once a hold has run to the end, until reset(). */
  readonly done: boolean
  /** Empties it, so it can be held again. */
  reset(): void
  /** Swaps options, such as fresh callbacks after a render. */
  set(next: Partial<HoldOptions>): void
  /** Removes every listener, attribute and property it added. Bound, so it can be passed on as is. */
  destroy: () => void
}

/**
 * Press and hold `el` to confirm, on a fair clock. Let go early and it runs back. A tap, Enter or
 * Space never confirms: it calls onTap, so the app can offer a confirm step.
 */
export function detentHold(el: HTMLElement, options: HoldOptions = {}): Hold {
  let o = options
  const ac = new AbortController()
  const signal = ac.signal
  const opts = { signal }
  const buzz = haptics(() => o.haptics)

  let p = 0
  let done = false
  let raf = () => {}
  let tapTimer = 0
  let press: { t0: number; key?: string } | null = null

  const fire = (type: keyof HoldEventMap) => el.dispatchEvent(new CustomEvent(type, { detail: {}, bubbles: true }))
  const paint = (v: number) => {
    p = v
    if (o.cssVar) el.style.setProperty(o.cssVar, v.toFixed(4))
    o.onInput?.(v)
    el.dispatchEvent(new CustomEvent('detenthold:input', { detail: { progress: v }, bubbles: true }))
  }

  const finish = () => {
    raf()
    press = null
    el.removeAttribute('data-held')
    paint(1)
    done = true
    el.toggleAttribute('data-done', true)
    buzz.tick(true)
    o.onConfirm?.()
    fire('detenthold:confirm')
  }

  const run = () => {
    raf()
    let last = performance.now()
    const step = (now: number) => {
      const next = Math.min(1, p + Math.max(0, now - last) / (o.time ?? 1500))
      last = now
      paint(next)
      if (next >= 1) return finish()
      raf = frame(step)
    }
    raf = frame(step)
  }

  // Back fast and easing out: a rubber band, not a clock.
  const rewind = () => {
    raf()
    const from = p
    const length = reduced(o.motion) ? 0 : (o.rewind ?? 140)
    if (!length || !from) return paint(0)
    const t0 = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / length)
      paint(from * Math.pow(1 - t, 3))
      if (t < 1) raf = frame(step)
    }
    raf = frame(step)
  }

  const tapped = () => {
    clearTimeout(tapTimer)
    tapTimer = 0
    o.onTap?.()
    fire('detenthold:tap')
  }

  const start = (key?: string) => {
    if (done || press) return
    clearTimeout(tapTimer)
    tapTimer = 0
    press = { t0: performance.now(), key }
    el.toggleAttribute('data-held', true)
    run()
  }

  const letGo = (tapAllowed: boolean) => {
    const pr = press
    press = null
    el.removeAttribute('data-held')
    if (!pr || done) return
    rewind()
    if (!tapAllowed || performance.now() - pr.t0 >= (o.tap ?? 250)) {
      o.onCancel?.()
      return fire('detenthold:cancel')
    }
    if (pr.key) return tapped()
    // A tap counts on the click that follows, once the browser has focused the element, so the app can
    // move focus into its confirm step. If no click comes, it counts anyway.
    tapTimer = window.setTimeout(tapped, o.tap ?? 250)
  }

  hand(
    el,
    {
      grab: () => start(),
      move: (_, q) => {
        if (!press || press.key) return
        const r = el.getBoundingClientRect()
        const m = o.leave ?? 16
        if (q.x < r.left - m || q.x > r.right + m || q.y < r.top - m || q.y > r.bottom + m) letGo(false)
      },
      end: (how) => {
        if (press && !press.key) letGo(how !== 'cancel')
      },
    },
    signal,
    'manipulation',
  )

  // A held Enter or Space works like a held finger. One press is a tap, since holding a key is hard for many people.
  const isKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' '
  el.addEventListener(
    'keydown',
    (e) => {
      if (!isKey(e)) return
      e.preventDefault()
      if (!e.repeat) start(e.key)
    },
    opts,
  )
  el.addEventListener(
    'keyup',
    (e) => {
      if (!isKey(e)) return
      e.preventDefault()
      if (press?.key === e.key) letGo(true)
    },
    opts,
  )
  el.addEventListener('blur', () => press?.key && letGo(false), opts)
  // A screen reader or voice control sends a click with no press: that is a tap too.
  el.addEventListener(
    'click',
    (e) => {
      if (done || press) return
      if (e.detail === 0 || tapTimer) tapped()
    },
    opts,
  )
  el.addEventListener('contextmenu', (e) => e.preventDefault(), opts)

  paint(0)

  const destroy = () => {
    if (signal.aborted) return
    ac.abort()
    buzz.off()
    raf()
    clearTimeout(tapTimer)
    press = null
    for (const n of ['data-held', 'data-done']) el.removeAttribute(n)
    if (o.cssVar) el.style.removeProperty(o.cssVar)
  }
  if (o.signal?.aborted) destroy()
  else o.signal?.addEventListener('abort', destroy, { once: true, signal })

  return {
    get progress() {
      return p
    },
    get done() {
      return done
    },
    reset() {
      if (signal.aborted) return
      raf()
      clearTimeout(tapTimer)
      tapTimer = 0
      press = null
      done = false
      el.removeAttribute('data-done')
      el.removeAttribute('data-held')
      paint(0)
    },
    set(next) {
      o = { ...o, ...next }
    },
    destroy,
  }
}
