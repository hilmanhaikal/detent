import { clamp, speedTracker, springTo, wrap } from './core.js'
import { attrs, needsName, voice } from './aria.js'
import { hand } from './hand.js'
import { reduced, type Motion } from './motion.js'
import { haptics, type Haptics } from './haptics.js'

export type Face = {
  /** Turn round the upright axis, in degrees. Positive turns the front to the right. Default 0. */
  yaw?: number
  /** Tilt, in degrees. Positive tilts the front up, so -90 shows the top. Default 0. */
  pitch?: number
  /** Turn round the line of sight, in degrees, clockwise like CSS rotate. Default 0. */
  roll?: number
  /** Pulls from further away. */
  strong?: boolean
  /** Said by screen readers when it lands here. */
  name: string
}

/** Degrees, applied the way CSS reads `rotateY(yaw) rotateX(pitch) rotateZ(roll)`. */
export type Rotation = { yaw: number; pitch: number; roll: number }

/** x, y, z, w in three.js axes (y up), ready for `object.quaternion.set(...q)`. */
export type Quaternion = [number, number, number, number]

export type Detent3dEventMap = {
  /** Every frame while it turns: the rotation in degrees, and the quaternion for three.js. */
  'detent3d:input': CustomEvent<Rotation & { quaternion: Quaternion }>
  /** Once, when it comes to rest on a new face. */
  'detent3d:change': CustomEvent<{ index: number; face: Face }>
}

declare global {
  interface HTMLElementEventMap extends Detent3dEventMap {}
}

export type Detent3dOptions = {
  /** The orientations it rests on: your own list, 'cube' (front, right, back, left, top, bottom) or 'turntable' (views evenly round the upright axis). */
  faces: Face[] | 'cube' | 'turntable'
  /** How many views a turntable has. Default 8. */
  views?: number
  /** Names for the faces of 'cube' or 'turntable', in order. Default: the side names, or degrees. */
  names?: string[]
  /** What a drag turns. 'yaw' spins round the upright axis, 'pitch' tilts, 'both' turns freely. Default 'yaw' on a turntable, else 'both'. */
  axes?: 'yaw' | 'pitch' | 'both'
  /** The face it starts on. Default 0. */
  value?: number
  /** Degrees of turn for each px the hand moves. Default 0.5. */
  degreesPerPx?: number
  /** How far a flick carries, in seconds of its speed. Default 0.2. */
  coast?: number
  /** The fastest a flick may turn, in degrees per second. Default 900. */
  maxSpeed?: number
  /** One spring swing in ms. Default 320. */
  period?: number
  /** Default 'auto': follows prefers-reduced-motion, live. */
  motion?: Motion
  /** On 'both', says the face's name in a polite live region when it lands. One axis speaks through its value instead. Default true. */
  announce?: boolean
  /** CSS custom properties that get the live yaw and pitch in degrees, and roll if you name a third. Off unless you name them. */
  cssVar?: [`--${string}`, `--${string}`] | [`--${string}`, `--${string}`, `--${string}`]
  /** A short tick on phones that vibrate, when the person's move lands on a new face. true: strong faces only. 'all': every face. Default false. */
  haptics?: Haptics
  /** Aborting it is the same as destroy(). */
  signal?: AbortSignal
  /** Every frame while it turns, and once at the start so you can draw it. */
  onInput?: (rotation: Rotation, quaternion: Quaternion) => void
  /** It came to rest on a new face. */
  onChange?: (index: number, face: Face) => void
}

export type Detent3d = {
  /** The face it rests on, or is going to. */
  readonly index: number
  /** How it is turned now, in degrees. On one axis the angle keeps counting past a full turn, so it never jumps. */
  readonly rotation: Rotation
  /** How it is turned now, in three.js axes. */
  readonly quaternion: Quaternion
  /** True while a hand or a glide turns it. */
  readonly moving: boolean
  /** Turns to a face. With { instant: true } it jumps. */
  go(index: number, opts?: { instant?: boolean }): void
  /** Swaps options, such as faces or callbacks. axes and announce stay as they started. */
  set(next: Partial<Detent3dOptions>): void
  /** Removes every listener, attribute and property it added. Bound, so it can be passed on as is. */
  destroy: () => void
}

type Q = number[]
const rad = Math.PI / 180

const axisQ = (x: number, y: number, z: number, deg: number): Q => {
  const s = Math.sin((deg * rad) / 2)
  return [x * s, y * s, z * s, Math.cos((deg * rad) / 2)]
}
const mul = (a: Q, b: Q): Q => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
const dot = (a: Q, b: Q) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
const unit = (a: Q) => a.map((n) => n / Math.hypot(...a))
const inverse = (a: Q) => [-a[0], -a[1], -a[2], a[3]]

/** The signed turn from `from` to `to` the short way round, in degrees from -180 to 180. */
export const shortest = (from: number, to: number) => wrap(to - from + 180, 360) - 180

/** A face as a quaternion in CSS axes (y down), x, y, z, w. */
export const faceQuaternion = ({ yaw = 0, pitch = 0, roll = 0 }: Face | Rotation): Q => mul(mul(axisQ(0, 1, 0, yaw), axisQ(1, 0, 0, pitch)), axisQ(0, 0, 1, roll))

/** The angle between two rotations, in degrees, the short way. */
export const between = (a: Q, b: Q) => (2 * Math.acos(Math.min(1, Math.abs(dot(a, b))))) / rad

/** Part way from `a` to `b`, the short way round: 0 is a, 1 is b. */
export function slerp(a: Q, b: Q, t: number): Q {
  let d = dot(a, b)
  const s = d < 0 ? -1 : 1
  d *= s
  if (d > 0.9995) return unit(a.map((n, i) => n + (s * b[i] - n) * t))
  const th = Math.acos(d)
  const p = Math.sin((1 - t) * th) / Math.sin(th)
  const q = (s * Math.sin(t * th)) / Math.sin(th)
  return a.map((n, i) => p * n + q * b[i])
}

/** A quaternion in CSS axes as yaw, pitch and roll in degrees. Pitch stays within 90 either way. */
export function toRotation([x, y, z, w]: Q): Rotation {
  const m23 = clamp(2 * (y * z - w * x), -1, 1)
  const open = Math.abs(m23) < 0.9999999
  return {
    yaw: (open ? Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y)) : Math.atan2(2 * (w * y - x * z), 1 - 2 * (y * y + z * z))) / rad,
    pitch: Math.asin(-m23) / rad,
    roll: open ? Math.atan2(2 * (x * y + w * z), 1 - 2 * (x * x + z * z)) / rad : 0,
  }
}

const score = (d: number, f: Face) => Math.abs(d) / (f.strong ? 1.5 : 1)

// Each face can rest in more than one way: the cube's top and bottom in four turns of their own plane.
const nearestOf = (q: Q, faces: Face[], ways: Q[][]) => {
  let best = [0, 0]
  let low = Infinity
  ways.forEach((list, i) =>
    list.forEach((w, j) => {
      const s = score(between(q, w), faces[i])
      if (s < low) [best, low] = [[i, j], s]
    }),
  )
  return best
}

/** The face nearest to a rotation. A strong face counts as 1.5 times nearer. */
export const nearestFace = (q: Q, faces: Face[]) => nearestOf(q, faces, faces.map((f) => [faceQuaternion(f)]))[0]

/** On one axis: the face nearest to `angle`, and the angle to land on, reached the short way. */
export function nearestAngle(angle: number, faces: Face[], axis: 'yaw' | 'pitch' = 'yaw') {
  let index = 0
  let at = angle
  let low = Infinity
  faces.forEach((f, i) => {
    const d = shortest(angle, f[axis] ?? 0)
    if (score(d, f) < low) [index, at, low] = [i, angle + d, score(d, f)]
  })
  return { index, at }
}

const sides = ['Front', 'Right', 'Back', 'Left', 'Top', 'Bottom']
const cube = [0, -90, 180, 90, 0, 0]

/** The faces an option asks for. */
export function facesOf({ faces, views = 8, names = [] }: Pick<Detent3dOptions, 'faces' | 'views' | 'names'>): Face[] {
  if (Array.isArray(faces)) return faces
  if (faces === 'cube') return sides.map((name, i) => ({ yaw: cube[i], pitch: i < 4 ? 0 : i < 5 ? -90 : 90, name: names[i] ?? name }))
  const n = Math.max(1, Math.round(views))
  return Array.from({ length: n }, (_, i) => {
    const yaw = (i * 360) / n
    return { yaw, name: names[i] ?? (i ? `${Math.round(yaw)} degrees` : 'Front') }
  })
}

// Arrow keys turn it the way a drag would: about the screen's upright axis or its level one.
const keyAxis: Record<string, number[]> = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowUp: [1, 0], ArrowDown: [-1, 0] }

/** Spin or tilt `el`, and it clicks into the nearest face. Arrow keys turn it to the next face that way. */
export function detent3d(el: HTMLElement, options: Detent3dOptions): Detent3d {
  let o = options
  const ac = new AbortController()
  const signal = ac.signal
  const a = attrs(el)
  const axes = o.axes ?? (o.faces === 'turntable' ? 'yaw' : 'both')
  const free = axes === 'both'
  const speak = free && o.announce !== false ? voice() : null
  const buzz = haptics(() => o.haptics)
  let person = false

  let faces: Face[] = []
  const angleOf = (f?: Face) => (axes === 'pitch' ? f?.pitch : f?.yaw) ?? 0
  let qs: Q[][] = []
  let ring: number[] = []
  const read = () => {
    faces = facesOf(o)
    qs = faces.map((f, i) => (o.faces === 'cube' && i > 3 ? [0, 90, 180, 270].map((r) => mul(axisQ(1, 0, 0, f.pitch!), axisQ(0, 1, 0, r))) : [faceQuaternion(f)]))
    // One axis: the faces in turning order, which the keys and the slider value follow.
    ring = faces.map((_, i) => i).sort((p, r) => wrap(angleOf(faces[p]), 360) - wrap(angleOf(faces[r]), 360))
  }
  read()
  const fit = (i: number) => clamp(Math.round(i), 0, Math.max(0, faces.length - 1))
  let index = fit(o.value ?? 0)
  // The face it last came to rest on. A glide that is grabbed and put back is not a change.
  let rested = index
  let moving = false
  let stop = () => {}
  // One axis is a plain angle that keeps counting round; 'both' is a quaternion.
  let angle = angleOf(faces[index])
  let target = angle
  let q: Q = qs[index]?.[0] ?? [0, 0, 0, 1]
  // Where a free turn rests, or is going to.
  let goal = q
  let rot: Rotation = { yaw: 0, pitch: 0, roll: 0 }

  const quaternion = (): Quaternion => [-q[0], q[1], -q[2], q[3]]
  const paint = (exact?: Face) => {
    if (!free) {
      const b = faces[0] ?? { name: '' }
      rot = { yaw: axes === 'yaw' ? angle : (b.yaw ?? 0), pitch: axes === 'pitch' ? angle : (b.pitch ?? 0), roll: b.roll ?? 0 }
      q = faceQuaternion(rot)
    } else rot = exact ? { yaw: exact.yaw ?? 0, pitch: exact.pitch ?? 0, roll: exact.roll ?? 0 } : toRotation(q)
    const out = quaternion()
    o.cssVar?.forEach((n, i) => el.style.setProperty(n, [rot.yaw, rot.pitch, rot.roll][i].toFixed(3)))
    o.onInput?.({ ...rot }, out)
    el.dispatchEvent(new CustomEvent('detent3d:input', { detail: { ...rot, quaternion: out }, bubbles: true }))
  }
  const setMoving = (m: boolean) => {
    moving = m
    el.toggleAttribute('data-moving', m)
  }
  const say = () => {
    if (free) return
    a.set('aria-valuenow', String(Math.max(0, ring.indexOf(index))))
    if (!faces[index]) return
    a.set('aria-valuetext', faces[index].name)
  }

  const land = (i: number) => {
    setMoving(false)
    say()
    speak?.say(faces[i].name)
    const mine = person
    person = false
    if (i === rested) return
    if (mine) buzz.tick(!!faces[i].strong)
    rested = i
    o.onChange?.(i, faces[i])
    el.dispatchEvent(new CustomEvent('detent3d:change', { detail: { index: i, face: faces[i] }, bubbles: true }))
  }

  const period = (instant?: boolean) => (instant || reduced(o.motion) ? 0 : (o.period ?? 320))
  // Only speed toward the face carries over, and no more than it can lose without passing it.
  const carry = (s: number, d: number) => (Math.sign(s) === Math.sign(d) ? Math.sign(d) * Math.min(Math.abs(s), Math.abs(d) / 0.06) : 0)

  // `w` is the hand's speed in degrees per second: the angle's on one axis, or a turn axis in CSS axes.
  // `aim` picks which way a face rests when it has more than one. Default: the nearest to where it is.
  function go(i: number, opts?: { instant?: boolean }, w = [0, 0, 0], dir = 0, aim = q) {
    stop()
    if (!faces.length) return setMoving(false)
    index = fit(i)
    const from = q
    const way = nearestOf(aim, [faces[index]], [qs[index]])[1]
    const pick = qs[index][way]
    const to = (goal = dot(from, pick) < 0 ? pick.map((n) => -n) : pick)
    const D = between(from, to) || 1
    const r = mul(to, inverse(from))
    let start = 0
    let end = 1
    let v = (w[0] * r[0] + w[1] * r[1] + w[2] * r[2]) / (Math.hypot(r[0], r[1], r[2]) || 1) / D
    if (!free) {
      const d = wrap(angleOf(faces[index]) - target, 360)
      start = angle
      end = target += dir > 0 || (!dir && d <= 180) ? d : d && d - 360
      v = w[0]
    }
    setMoving(true)
    stop = springTo({
      from: start,
      to: end,
      velocity: carry(v, end - start),
      period: period(opts?.instant),
      damping: 1,
      rest: free ? 0.05 / D : 0.05,
      onFrame: (n) => {
        if (free) q = slerp(from, to, n)
        else angle = n
        paint()
      },
      onDone: () => {
        if (free) q = to
        paint(way ? undefined : faces[index])
        land(index)
      },
    })
  }

  const sx = speedTracker()
  const sy = speedTracker()
  let px = { x: 0, y: 0 }
  const k = () => o.degreesPerPx ?? 0.5
  hand(
    el,
    {
      grab: () => {
        stop()
        person = true
        px = { x: 0, y: 0 }
        sx.reset()
        sy.reset()
        sx.add(0)
        sy.add(0)
      },
      move: (p, n) => {
        const dx = n.x - p.x
        const dy = n.y - p.y
        px = { x: px.x + dx, y: px.y + dy }
        sx.add(px.x)
        sy.add(px.y)
        setMoving(true)
        if (!free) angle += (axes === 'yaw' ? dx : -dy) * k()
        else {
          const len = Math.hypot(dx, dy)
          if (!len) return
          q = unit(mul(axisQ(-dy / len, dx / len, 0, len * k()), q))
        }
        paint()
      },
      end: (how) => {
        let vx = how === 'release' ? sx.speed() * k() : 0
        let vy = how === 'release' ? -sy.speed() * k() : 0
        if (axes === 'yaw') vy = 0
        if (axes === 'pitch') vx = 0
        const s = Math.hypot(vx, vy)
        const cap = o.maxSpeed ?? 900
        if (s > cap) [vx, vy] = [(vx * cap) / s, (vy * cap) / s]
        const c = period() ? (o.coast ?? 0.2) : 0
        if (!free) {
          target = angle + (vx + vy) * c
          return go(nearestAngle(target, faces, axes as 'yaw').index, undefined, [vx + vy])
        }
        const len = Math.min(s, cap)
        const ahead = len && c ? mul(axisQ(vy / len, vx / len, 0, len * c), q) : q
        go(nearestOf(ahead, faces, qs)[0], undefined, [vy, vx, 0], 0, ahead)
      },
    },
    signal,
    'none',
  )

  el.addEventListener(
    'keydown',
    (e) => {
      const n = faces.length
      if (e.altKey || e.ctrlKey || e.metaKey || !n) return
      let to = e.key === 'Home' ? ring[0] : e.key === 'End' ? ring[n - 1] : -1
      let aim = q
      let dir = 0
      const big = Math.max(1, Math.round(n / 4))
      const by = free ? 0 : ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: big, PageDown: -big } as Record<string, number>)[e.key]
      if (by) {
        to = ring[wrap(ring.indexOf(index) + by, n)]
        dir = by
      }
      const way = free && keyAxis[e.key]
      // Turn the way the key points, a little more each time, until another face is the nearest.
      for (let d = 10; way && to < 0 && d <= 180; d += 10) {
        aim = mul(axisQ(way[0], way[1], 0, d), goal)
        const i = nearestOf(aim, faces, qs)[0]
        if (i !== index) to = i
      }
      if (to < 0) return
      e.preventDefault()
      person = true
      go(to, undefined, undefined, dir, aim)
    },
    { signal },
  )

  const place = () => {
    if (!free) angle = target += shortest(target, angleOf(faces[index]))
    else if (faces[index]) q = goal = qs[index][0]
    paint(faces[index])
    say()
  }
  const range = () => {
    if (free) return
    a.set('aria-valuemin', '0')
    a.set('aria-valuemax', String(Math.max(0, faces.length - 1)))
  }

  a.fill('tabindex', '0')
  if (free) {
    if (!el.hasAttribute('role')) {
      a.set('role', 'group')
      a.fill('aria-roledescription', 'rotatable')
    }
  } else {
    a.fill('role', 'slider')
    if (el.getAttribute('role') === 'slider') a.set('aria-orientation', axes === 'pitch' ? 'vertical' : 'horizontal')
    range()
  }
  needsName(el)
  place()

  const destroy = () => {
    if (signal.aborted) return
    ac.abort()
    buzz.off()
    stop()
    speak?.off()
    a.restore()
    el.removeAttribute('data-moving')
    o.cssVar?.forEach((n) => el.style.removeProperty(n))
  }
  if (o.signal?.aborted) destroy()
  else o.signal?.addEventListener('abort', destroy, { once: true, signal })

  return {
    get index() {
      return index
    },
    get rotation() {
      return { ...rot }
    },
    get quaternion() {
      return quaternion()
    },
    get moving() {
      return moving
    },
    go: (i, opts) => {
      person = false
      go(i, opts)
    },
    set(next) {
      o = { ...o, ...next }
      read()
      range()
      rested = fit(rested)
      index = fit(index)
      if (!moving) place()
      else if ('faces' in next || 'views' in next) go(index)
    },
    destroy,
  }
}
