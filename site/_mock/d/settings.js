// The console's settings. Every control on the page listens, so changing one changes how all of them feel.
export const settings = { coast: 0.2, period: 280, reach: 0.35, strong: 1.5 }
const listeners = new Set()
export function onSettings(fn) {
  listeners.add(fn)
  fn(settings)
}
export function change(next) {
  Object.assign(settings, next)
  listeners.forEach((fn) => fn(settings))
}
