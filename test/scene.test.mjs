// scrollScene's range and progress, with a stand-in page: a target at 1000 px, 600 px tall, in a 700 px window.
import assert from 'node:assert/strict'
import { test } from 'node:test'

const listeners = {}
Object.assign(globalThis, {
  innerHeight: 700,
  scrollY: 0,
  addEventListener: (type, fn) => (listeners[type] = fn),
  requestAnimationFrame: (fn) => setTimeout(() => fn(performance.now()), 1),
  cancelAnimationFrame: (id) => clearTimeout(id),
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
  document: { documentElement: {}, hidden: false, addEventListener() {}, removeEventListener() {} },
})
const { scrollScene, timeline } = await import('../dist/index.js')
const target = { offsetTop: 1000, offsetHeight: 600, offsetParent: null }
const make = (o) => {
  const box = { v: 0 }
  const tl = timeline({ paused: true }).add(box, { to: { v: 300 }, duration: 300, ease: 'linear' }).label('third', 100).label('end')
  return { box, scene: scrollScene(tl, { target, ...o }) }
}
const scroll = async (y) => {
  globalThis.scrollY = y
  listeners.scroll()
  await new Promise((r) => setTimeout(r, 5))
}

test('the default range runs from the target entering to it leaving', async () => {
  const { box, scene } = make()
  assert.equal(scene.progress, 0)
  await scroll(950)
  assert.equal(scene.progress, 0.5)
  assert.equal(box.v, 150)
  await scroll(99999)
  assert.equal(box.v, 300, 'a fling past it lands on the end')
  await scroll(-50)
  assert.equal(box.v, 0, 'and back on the start')
  scene.destroy()
})

test('start and end take edges and percentages', async () => {
  const { scene } = make({ start: 'top center', end: '50% top' })
  // From 1000 - 350 = 650 to 1000 + 300 = 1300.
  await scroll(975)
  assert.equal(scene.progress, 0.5)
  scene.destroy()
})

test('marks are the labels as scroll positions', () => {
  globalThis.scrollY = 0
  const { scene } = make()
  assert.deepEqual(scene.marks(), [733, 1600])
  scene.destroy()
})

test('reduced motion jumps to the end once it comes in', async () => {
  const { box, scene } = make({ motion: 'reduce' })
  await scroll(310)
  assert.equal(box.v, 300)
  await scroll(0)
  assert.equal(box.v, 0)
  scene.destroy()
})
