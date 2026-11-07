import { detentScroll } from '@hlmnhkl/detent'
import { copyButtons } from '../shared/controls'
import '../home/header'

// Every demo file runs, and the same file's text is what the page shows. One source, so they cannot drift.
const run = import.meta.glob(['./demos/*.js', './recipes/*.js'])
const text = import.meta.glob(['./demos/*.js', './recipes/*.js'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

document.querySelectorAll<HTMLElement>('[data-src]').forEach((pre) => {
  const code = document.createElement('code')
  code.textContent = text[`./${pre.dataset.src}`].trim()
  pre.replaceChildren(code)
})
document.querySelectorAll<HTMLElement>('[data-run]').forEach((el) => run[`./${el.dataset.run}`]())

// Tabs: arrow keys move between them, as in any tab list.
document.querySelectorAll<HTMLElement>('[role="tablist"]').forEach((list) => {
  const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')]
  const show = (tab: HTMLElement, focus = false) => {
    tabs.forEach((t) => {
      const on = t === tab
      t.setAttribute('aria-selected', String(on))
      t.tabIndex = on ? 0 : -1
      document.getElementById(t.getAttribute('aria-controls')!)!.hidden = !on
    })
    if (focus) tab.focus()
    list.dispatchEvent(new CustomEvent('tabchange', { detail: tab, bubbles: true }))
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t))
    t.addEventListener('keydown', (e) => {
      const to = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null
      if (to === null) return
      e.preventDefault()
      show(tabs[(to + tabs.length) % tabs.length], true)
    })
  })
  show(tabs.find((t) => t.getAttribute('aria-selected') === 'true') ?? tabs[0])
})

// The live ARIA view: the attributes detent keeps on a control, read straight from the element.
document.querySelectorAll<HTMLElement>('[data-aria-of]').forEach((view) => {
  const names = ['role', 'tabindex', 'aria-label', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'aria-orientation']
  let watch: MutationObserver | null = null
  const follow = (el: HTMLElement | null) => {
    watch?.disconnect()
    if (!el) return
    const paint = () => (view.innerHTML = names.filter((n) => el.hasAttribute(n)).map((n) => `<div><dt>${n}</dt><dd>${el.getAttribute(n)}</dd></div>`).join(''))
    watch = new MutationObserver(paint)
    watch.observe(el, { attributes: true })
    paint()
  }
  const sel = view.dataset.ariaOf
  const pick = () => follow([...document.querySelectorAll<HTMLElement>(`${sel} [role="slider"], ${sel} [role="spinbutton"]`)].find((el) => !el.closest('[hidden]')) ?? null)
  addEventListener('tabchange', () => queueMicrotask(pick))
  setTimeout(pick, 100)
})

// What a screen reader is told by detent2d, echoed from its polite live region.
// Writing the echo is itself a change, so only write when the words differ, or it would loop forever.
// It watches only the live region, never the whole page, so writing the echo cannot wake it again.
document.querySelectorAll<HTMLElement>('[data-voice-echo]').forEach((echo) => {
  const listen = (region: Element) =>
    new MutationObserver(() => {
      const said = region.textContent
      if (said && echo.textContent !== said) echo.textContent = said
    }).observe(region, { childList: true, characterData: true, subtree: true })
  const found = document.querySelector('[data-detent-voice]')
  if (found) return void listen(found)
  // The region is made when detent2d starts; until then, watch only the body's direct children.
  const wait = new MutationObserver(() => {
    const region = document.querySelector('[data-detent-voice]')
    if (!region) return
    wait.disconnect()
    listen(region)
  })
  wait.observe(document.body, { childList: true })
})

// Docs are for reading: in-page links glide and focus their heading, but the page never settles by itself.
const never = 2 ** 31 - 1
detentScroll({ offset: document.querySelector<HTMLElement>('.top') ?? undefined, idle: { wheel: never, touch: never } })

copyButtons()
