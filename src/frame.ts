// One shared frame for every detent module: one requestAnimationFrame per frame however much moves.
// Frames can stall (a hidden tab, some phones, CI WebKit), so a timer stands in for a late frame and
// every motion still ends in real time. When recent frames run long (a low-end phone, a busy page), motion
// that can wait is drawn every other frame. Every motion runs on real elapsed time, so a skipped
// frame changes how smooth it looks, never where it ends.

type Job = { fn: (now: number) => void; off?: boolean }

let jobs: Job[] = []
let raf = 0
let timer: ReturnType<typeof setTimeout> | undefined
let last = 0
let avg = 16
let odd = false
let low = false
// Slow past 28 ms a frame, back below 20 ms: two lines, so it does not flip back and forth.
let slow = 28
let fast = 20

function tick(now: number) {
  cancelAnimationFrame(raf)
  clearTimeout(timer)
  raf = 0
  // A long gap is a pause between motions, not a slow frame. The average leans on the last 8 or so.
  if (now - last < 100) avg += (now - last - avg) / 8
  last = now
  low = avg > (low ? fast : slow)
  odd = !odd
  const run = jobs
  jobs = []
  for (const j of run) j.off || (!low || odd ? j.fn(now) : jobs.push(j))
  if (jobs.length && !raf) wake()
}
const wake = () => {
  raf = requestAnimationFrame(tick)
  timer = setTimeout(() => tick(performance.now()), 100)
}

/** Runs `fn` once on the next shared frame. Returns a cancel function. */
export function frame(fn: (now: number) => void) {
  const job: Job = { fn }
  jobs.push(job)
  if (!raf) wake()
  return () => void (job.off = true)
}

/** How the device keeps up. `low` is true when recent frames run long, and motion that can wait is drawn every other frame. */
export const frameBudget = {
  /** True when recent frames run long. */
  get low() {
    return low
  },
  /** The recent time between frames, in ms. */
  get frameMs() {
    return avg
  },
  /** Sets low or not yourself, for a setting in your app or a test. null measures again. */
  force(value: boolean | null) {
    ;[slow, fast] = value === null ? [28, 20] : value ? [-1, -1] : [Infinity, Infinity]
    low = !!value
  },
}
