import { follow, springTo } from '@hlmnhkl/detent'
import pkg from '../../package.json'

const reduced = matchMedia('(prefers-reduced-motion: reduce)')
const time = () => (reduced.matches ? 0 : 220)

// The version comes from package.json, so the page never shows a stale one.
document.querySelectorAll('[data-version]').forEach((el) => (el.textContent = `v${pkg.version}`))


// Calm on scroll: colour and a hairline only, the height never changes.
const top = document.querySelector<HTMLElement>('.top')!
// The notch clicks one step per section, eased by the engine. A time of 0 (reduced motion) just jumps.
const sections = [...document.querySelectorAll<HTMLElement>('[data-mark]')]
// One tick per section, so the notch fits any page.
const notchEl = top.querySelector<HTMLElement>('.notch')
if (notchEl) notchEl.innerHTML = sections.map((_, i) => `<i style="--i:${i}"></i>`).join('') + '<b></b>'
notchEl?.style.setProperty('--count', String(Math.max(1, sections.length)))
const notch = follow({ value: 0, time, onFrame: (n) => top.style.setProperty('--n', n.toFixed(3)) })
let raf = 0
const paint = () => {
  raf = 0
  top.toggleAttribute('data-calm', scrollY > 8)
  const line = scrollY + innerHeight * 0.4
  let i = 0
  sections.forEach((s, k) => {
    if (s.getBoundingClientRect().top + scrollY <= line) i = k
  })
  notch.set(i)
}
addEventListener('scroll', () => (raf ||= requestAnimationFrame(paint)), { passive: true })
paint()

// Phone menu: a native dialog (focus kept inside, Esc closes, focus returns to the button) that
// rises as a bottom sheet with the engine's spring.
const dialog = document.querySelector<HTMLDialogElement>('#menu')!
const sheet = dialog.querySelector<HTMLElement>('.menu-sheet')!
const opener = document.querySelector<HTMLButtonElement>('.menu-open')!
let stopSheet = () => {}
const slide = (from: number, to: number, done = () => {}) => {
  stopSheet()
  stopSheet = springTo({ from, to, period: time() * 1.4, damping: 1, rest: 0.5, onFrame: (y) => sheet.style.setProperty('--y', y.toFixed(2)), onDone: done })
}
opener.addEventListener('click', () => {
  dialog.showModal()
  slide(100, 0)
})
const close = (now = false) => {
  if (!dialog.open) return
  if (now || reduced.matches) return dialog.close()
  slide(0, 100, () => dialog.close())
}
dialog.querySelector('.menu-close')!.addEventListener('click', () => close())
dialog.addEventListener('cancel', (e) => {
  e.preventDefault()
  close()
})
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) close()
})
// A link closes the menu at once, then the page glides to it.
dialog.querySelectorAll('nav a').forEach((a) => a.addEventListener('click', () => close(true)))
