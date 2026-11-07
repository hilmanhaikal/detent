// The maths of detent3d, run against the built dist: npm test builds first.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as detent from '../dist/index.js'
import { between, faceQuaternion as fq, facesOf, nearestAngle, nearestFace, shortest, slerp, toRotation } from '../dist/detent3d.js'

const cube = facesOf({ faces: 'cube' })
const near = (a, b, msg) => assert.ok(between(a, b) < 1e-4, `${msg}: ${between(a, b)} degrees apart`)

test('importing on a server touches no window, and detent3d is there', () => {
  assert.equal(typeof globalThis.window, 'undefined')
  assert.equal(typeof detent.detent3d, 'function')
})

test('presets: a cube has six named sides, a turntable even views', () => {
  assert.deepEqual(
    cube.map((f) => f.name),
    ['Front', 'Right', 'Back', 'Left', 'Top', 'Bottom'],
  )
  assert.deepEqual(
    facesOf({ faces: 'turntable' }).map((f) => f.yaw),
    [0, 45, 90, 135, 180, 225, 270, 315],
  )
  assert.equal(facesOf({ faces: 'turntable', views: 4, names: ['Front', 'Side'] })[1].name, 'Side')
  assert.equal(facesOf({ faces: 'turntable', views: 4 })[2].name, '180 degrees')
})

test('shortest: the short way round, never more than half a turn', () => {
  assert.equal(shortest(350, 10), 20)
  assert.equal(shortest(10, 350), -20)
  assert.equal(shortest(0, 720 + 90), 90)
  assert.equal(Math.abs(shortest(0, 180)), 180)
})

test('one axis: the nearest view, reached the short way, keeps counting past a turn', () => {
  const views = facesOf({ faces: 'turntable' })
  assert.deepEqual(nearestAngle(355, views), { index: 0, at: 360 })
  assert.deepEqual(nearestAngle(-170, views), { index: 4, at: -180 })
  assert.deepEqual(nearestAngle(400, views), { index: 1, at: 405 })
  assert.equal(nearestAngle(-80, [{ pitch: 0, name: 'Face' }, { pitch: -90, name: 'Top' }], 'pitch').index, 1)
})

test('nearest face: by the angle between, with strong faces reaching further', () => {
  assert.equal(nearestFace(fq({ yaw: 80 }), cube), 3)
  assert.equal(nearestFace(fq({ yaw: 40 }), cube), 0)
  assert.equal(nearestFace(fq({ yaw: 10, pitch: -60 }), cube), 4)
  assert.equal(nearestFace(fq({ yaw: 200 }), cube), 2)
  const plain = [{ yaw: 0, name: 'A' }, { yaw: 90, name: 'B' }]
  const strong = [{ yaw: 0, name: 'A' }, { yaw: 90, name: 'B', strong: true }]
  assert.equal(nearestFace(fq({ yaw: 40 }), plain), 0)
  assert.equal(nearestFace(fq({ yaw: 40 }), strong), 1, 'a strong face pulls from further away')
  assert.equal(nearestAngle(40, strong).index, 1)
})

test('slerp: starts on one face, ends exactly on the other, the short way', () => {
  const a = fq({ yaw: 10, pitch: 20 })
  const b = fq({ yaw: 170, pitch: -60, roll: 30 })
  near(slerp(a, b, 0), a, 'start')
  near(slerp(a, b, 1), b, 'end')
  const flipped = b.map((n) => -n)
  near(slerp(a, flipped, 1), b, 'a flipped sign is the same face')
  near(slerp(a, b, 0.5), slerp(a, flipped, 0.5), 'the same middle either sign')
  assert.ok(Math.abs(between(a, slerp(a, b, 0.5)) - between(a, b) / 2) < 1e-6, 'half way is half the angle')
  assert.ok(between(fq({ yaw: 0 }), fq({ yaw: 270 })) <= 90 + 1e-9, 'front to the yaw 270 face is a quarter turn, not three')
})

test('free turns never lock: yaw, pitch and roll always rebuild the same rotation', () => {
  for (const r of [{ yaw: 30, pitch: -90 }, { yaw: -120, pitch: 90, roll: 45 }, { yaw: 180 }, { yaw: 33, pitch: 71, roll: -150 }, { pitch: 135 }]) {
    const q = fq(r)
    const back = toRotation(q)
    near(fq(back), q, JSON.stringify(r))
    assert.ok(Math.abs(back.pitch) <= 90 + 1e-9)
  }
})
