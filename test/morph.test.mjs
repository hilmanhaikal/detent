// morph's FLIP maths on stand-in elements whose boxes we set by hand.
import assert from 'node:assert/strict'
import { test } from 'node:test'

globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} }
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 4)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
const { morph } = await import('../dist/index.js')

// A box at `at`, drawn through the transform morph writes, as a browser would.
const fake = (at) => {
  const el = {
    at,
    style: { transform: '', transformOrigin: '' },
    getBoundingClientRect() {
      const m = /translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+), ([-\d.e]+)\)/.exec(el.style.transform)
      const [x, y, sx, sy] = m ? m.slice(1).map(Number) : [0, 0, 1, 1]
      const [l, t, w, h] = el.at
      return { left: l + x, top: t + y, width: w * sx, height: h * sy }
    },
  }
  return el
}
const near = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 0.01, `${a} is not ${b}`))
const drawn = (el) => Object.values(el.getBoundingClientRect())

test('it starts drawn at the old box and lands on the new one', async () => {
  const el = fake([0, 0, 100, 50])
  const m = morph(el, () => (el.at = [200, 100, 300, 100]), { duration: 40, ease: 'linear' })
  near(drawn(el), [0, 0, 100, 50])
  assert.equal(el.style.transformOrigin, '0 0')
  assert.equal(await m.finished, true)
  near(drawn(el), [200, 100, 300, 100])
  assert.equal(el.style.transform, '')
})

test('a shared element starts at the other box', () => {
  const el = fake([0, 0, 100, 100])
  const thumb = fake([50, 60, 10, 10])
  const m = morph(el, () => {}, { from: thumb })
  near(drawn(el), [50, 60, 10, 10])
  m.stop()
  assert.equal(el.style.transform, '', 'stop puts it in its new place')
})

test('many elements, one change', async () => {
  const a = fake([0, 0, 10, 10])
  const b = fake([0, 20, 10, 10])
  const m = morph([a, b], () => ([a.at, b.at] = [b.at, a.at]))
  near(drawn(a), [0, 0, 10, 10])
  near(drawn(b), [0, 20, 10, 10])
  assert.equal(await m.finished, true)
  near(drawn(a), [0, 20, 10, 10])
})

test('reduced motion lands at once and still calls onDone', () => {
  const el = fake([0, 0, 10, 10])
  let done = false
  morph(el, () => (el.at = [90, 0, 10, 10]), { motion: 'reduce', onDone: () => (done = true) })
  assert.equal(el.style.transform, '')
  assert.equal(done, true)
})
