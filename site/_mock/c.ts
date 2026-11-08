import { clamp, detent, detentScroll, follow, nearestMark, speedTracker } from '@hlmnhkl/detent'

// Mockup C, living letters: type is the material. Every letter of the word is a detent control.
const reduced = matchMedia('(prefers-reduced-motion: reduce)')

// The word. Each letter rests at home (a strong notch) or one notch either side, so the word can be
// left in a new shape. Away from a notch it stretches along its track; at a notch it is itself again.
const word = document.querySelector<HTMLElement>('.c-word')!
const NOTCHES = [-1, 0, 1]
;[...word.textContent!.trim()].forEach((ch, i, all) => {
  const el = document.createElement('span')
  el.className = 'c-letter'
  el.textContent = ch
  el.setAttribute('aria-label', `Letter ${i + 1} of ${all.length}, ${ch}`)
  const where = (v: number) => (v === 0 ? 'home' : `${Math.abs(v)} notch ${v < 0 ? 'left' : 'right'}`)
  let away = false
  detent(el, {
    min: -1.4,
    max: 1.4,
    step: 0.01,
    value: 0,
    marks: [{ at: -1 }, { at: 0, strong: true }, { at: 1 }],
    snap: 'marks',
    edge: 0.3,
    coast: 0.15,
    size: () => parseFloat(getComputedStyle(el).fontSize) * 0.26,
    text: where,
    // Arrows go notch to notch; Home and Escape bring it home.
    keys: (key, v) => {
      if (key === 'ArrowRight' || key === 'ArrowUp') return Math.min(1, Math.round(v) + 1)
      if (key === 'ArrowLeft' || key === 'ArrowDown') return Math.max(-1, Math.round(v) - 1)
      if (key === 'Home' || key === 'Escape') return 0
      return null
    },
    onInput: (v) => {
      const off = Math.abs(v - nearestMark(v, NOTCHES)!)
      el.style.setProperty('--x', v.toFixed(3))
      el.style.setProperty('--stretch', off.toFixed(3))
      if (v !== 0) away = true
    },
    onChange: (v) => {
      if (v !== 0 || !away) return
      away = false
      // The click home: a short mustard mark and, on phones that have one, a tiny tap of the motor.
      el.removeAttribute('data-home')
      void el.offsetWidth
      el.setAttribute('data-home', '')
      if (!reduced.matches) navigator.vibrate?.(8)
    },
  })
  word.append(el)
})
word.firstChild?.nodeType === 3 && word.firstChild.remove()

// Section titles: letters you can push a little. They always settle back home.
document.querySelectorAll<HTMLElement>('[data-push]').forEach((title) => {
  const text = title.textContent!
  title.setAttribute('aria-label', text)
  title.textContent = ''
  ;[...text].forEach((ch) => {
    const el = document.createElement('span')
    el.className = 'c-push'
    el.textContent = ch
    el.setAttribute('aria-hidden', 'true')
    if (ch === ' ') return title.append(el)
    // Not a stop for keys or screen readers: the heading says its words once, as text.
    el.setAttribute('role', 'presentation')
    el.setAttribute('tabindex', '-1')
    el.setAttribute('aria-label', ch)
    detent(el, {
      min: -0.6,
      max: 0.6,
      step: 0.01,
      marks: [{ at: 0, strong: true }],
      snap: 'marks',
      edge: 0.25,
      size: () => parseFloat(getComputedStyle(el).fontSize) * 0.3,
      cssVar: '--x',
    })
    title.append(el)
  })
})

// The page settles onto its parts, and its type leans a little with the speed of the scroll.
const sections = [...document.querySelectorAll<HTMLElement>('[data-mark]')]
detentScroll({ marks: sections })
const speed = speedTracker(100)
const lean = follow({ value: 0, time: () => (reduced.matches ? 0 : 280), onFrame: (d) => document.documentElement.style.setProperty('--lean', `${d.toFixed(2)}deg`) })
let raf = 0
let calm = 0
addEventListener(
  'scroll',
  () => {
    raf ||= requestAnimationFrame(() => {
      raf = 0
      speed.add(scrollY)
      lean.set(reduced.matches ? 0 : clamp(-speed.speed() / 700, -5, 5))
    })
    clearTimeout(calm)
    calm = window.setTimeout(() => lean.set(0), 120)
  },
  { passive: true },
)

// The demos run their own files, and "the code" under each shows that same file.
const run = import.meta.glob('./c/*.js')
const text = import.meta.glob('./c/*.js', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
document.querySelectorAll<HTMLElement>('[data-src]').forEach((pre) => {
  const code = document.createElement('code')
  code.textContent = text[`./c/${pre.dataset.src}`].trim()
  pre.replaceChildren(code)
})
document.querySelectorAll<HTMLElement>('[data-run]').forEach((el) => run[`./c/${el.dataset.run}`]())

// The install command is a word in a sentence. Tap it to copy.
document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((b) => {
  const label = b.innerHTML
  b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(b.dataset.copy!)
      b.innerHTML = 'copied, paste it in your terminal'
    } catch {
      b.innerHTML = 'copy did not work, select it instead'
    }
    setTimeout(() => (b.innerHTML = label), 1800)
  })
})
