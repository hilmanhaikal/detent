/** false is off. true ticks only on strong marks and key moments. 'all' also ticks every plain mark. */
export type Haptics = boolean | 'all'

/**
 * A short tick on phones that can vibrate: Android Chrome and Firefox. iPhone Safari has no vibration
 * API, so there it does nothing. At most one tick every 80 ms, so a fast flick never turns into a buzz.
 */
export function haptics(level: () => Haptics | undefined) {
  let last = -Infinity
  let live = true
  return {
    tick(strong: boolean, now = performance.now()) {
      const h = level()
      if (!live || !h || (!strong && h !== 'all') || now - last < 80) return false
      if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
      last = now
      navigator.vibrate(strong ? 12 : 8)
      return true
    },
    off() {
      live = false
    },
  }
}
