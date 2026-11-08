import { frame } from './frame.js'

// One play head for animate and timeline, on the shared frame. Time only runs while the page is
// shown, so a hidden tab picks up where it left off.

export type Clock = ReturnType<typeof clock>

export function clock(length: () => number, draw: (t: number) => void, end: (landed: boolean) => void, reduce: () => boolean, start = 0) {
  let t = start
  let dir = 1
  let on = false
  let open = true
  let last = 0
  let raf = () => {}
  let settle!: (landed: boolean) => void
  let finished = new Promise<boolean>((r) => (settle = r))

  const halt = () => raf()
  const ended = () => (dir > 0 ? t >= length() : t <= start)
  const close = (landed: boolean) => {
    pause()
    if (!open) return
    open = false
    settle(landed)
    end(landed)
  }
  const step = (now: number) => {
    t += Math.max(0, now - last) * dir
    last = now
    draw(t)
    if (ended()) {
      t = dir > 0 ? length() : start
      close(true)
    } else schedule()
  }
  const schedule = () => {
    if (document.hidden) return
    raf = frame(step)
  }
  const shown = () => {
    halt()
    last = performance.now()
    schedule()
  }
  function pause() {
    on = false
    halt()
    document.removeEventListener('visibilitychange', shown)
  }
  const run = (d: number) => {
    if (on && dir === d) return
    if (!open) {
      open = true
      finished = new Promise((r) => (settle = r))
    }
    dir = d
    if (ended()) t = d > 0 ? start : length()
    if (reduce()) {
      draw((t = d > 0 ? length() : start))
      return close(true)
    }
    if (!on) document.addEventListener('visibilitychange', shown)
    on = true
    shown()
  }

  return {
    get t() {
      return t
    },
    get on() {
      return on
    },
    get finished() {
      return finished
    },
    play: () => run(1),
    reverse: () => run(-1),
    pause,
    seek(to: number) {
      draw((t = Math.min(length(), Math.max(start, to))))
    },
    stop: () => close(false),
  }
}
