import { frame } from './frame.js'
import { reduced, type Motion } from './motion.js'
import type { Timeline } from './timeline.js'

export type SceneOptions = {
  /** The element whose way through the screen is the scene's time. */
  target: HTMLElement
  /** Where the scene starts: the target's edge, then the screen's edge. Each is top, center, bottom or a percentage. Default 'top bottom'. */
  start?: string
  /** Where the scene ends, in the same words. Default 'bottom top'. */
  end?: string
  /** Default 'auto': with reduced motion, a scene jumps to its end as it comes in, and back to its start once it is gone above. */
  motion?: Motion
  /** Aborting it is the same as destroy(). */
  signal?: AbortSignal
  /** Every time the scene moves, with its progress from 0 to 1. */
  onUpdate?: (progress: number) => void
}

export type ScrollScene = {
  /** From 0 to 1. */
  readonly progress: number
  /** The timeline's labels as page scroll positions in px, for `detentScroll({ marks: scene.marks })`. */
  marks(): number[]
  /** Reads the target's place again. Resizes are handled. */
  measure(): void
  /** Lets go of the scroll. The timeline stays where it is. Bound, so it can be passed on as is. */
  destroy: () => void
}

const edges: Record<string, number> = { top: 0, center: 50, bottom: 100 }
const at = (word: string, size: number) => ((edges[word] ?? parseFloat(word)) / 100) * size

/**
 * A timeline whose time is the page's scroll through a range. It only reads the scroll, never moves
 * it, so the wheel, the finger and the keys stay the reader's. Scroll back and it plays back.
 */
export function scrollScene(tl: Timeline, options: SceneOptions): ScrollScene {
  const o = options
  const ac = new AbortController()
  let from = 0
  let to = 0
  let p = 0
  let wait: (() => void) | null = null

  function measure() {
    // Offsets, not the box on screen: the timeline may be moving the target itself.
    let top = 0
    for (let n: HTMLElement | null = o.target; n; n = n.offsetParent as HTMLElement | null) top += n.offsetTop
    const h = o.target.offsetHeight
    const [a, b] = (o.start ?? 'top bottom').split(' ')
    const [c, d] = (o.end ?? 'bottom top').split(' ')
    from = top + at(a, h) - at(b, innerHeight)
    to = top + at(c, h) - at(d, innerHeight)
  }
  // Worked out from where the page is, never from the last step, so a fast fling can never leave it halfway.
  const update = () => {
    wait = null
    const raw = to > from ? (scrollY - from) / (to - from) : +(scrollY >= from)
    p = Math.min(1, Math.max(0, raw))
    if (reduced(o.motion)) p = p > 0 ? 1 : 0
    tl.seek(p * tl.duration)
    o.onUpdate?.(p)
  }
  const soon = () => (wait ??= frame(update))
  const again = () => {
    measure()
    soon()
  }

  tl.pause()
  measure()
  update()
  addEventListener('scroll', soon, { passive: true, signal: ac.signal })
  addEventListener('resize', again, { signal: ac.signal })
  const watch = new ResizeObserver(again)
  watch.observe(o.target)
  watch.observe(document.documentElement)

  const destroy = () => {
    ac.abort()
    watch.disconnect()
    wait?.()
  }
  if (o.signal?.aborted) destroy()
  else o.signal?.addEventListener('abort', destroy, { once: true, signal: ac.signal })

  return {
    get progress() {
      return p
    },
    marks() {
      measure()
      return tl.marks().map((m) => Math.round(from + (tl.duration ? m.at / tl.duration : 0) * (to - from)))
    },
    measure: again,
    destroy,
  }
}
