import { clamp, detentScroll, follow, pull, speedTracker } from '@hlmnhkl/detent'

// The page settles onto each [data-mark] section with detentScroll. This file adds the homepage's own
// look on top: the side rail pulls the current section's number large, and the type leans with speed.

export function pageSettle() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const head = document.querySelector<HTMLElement>('.top') ?? undefined
  const sections = [...document.querySelectorAll<HTMLElement>('[data-mark]')]
  const page = detentScroll({ marks: sections, offset: head })

  const rail = document.querySelector<HTMLElement>('.rail')!
  rail.innerHTML = sections.map((s, i) => `<a href="#${s.id}" aria-label="${s.dataset.name}"><span>${i + 1}</span></a>`).join('')
  const railNums = [...rail.querySelectorAll<HTMLElement>('span')]
  const railLinks = [...rail.querySelectorAll<HTMLElement>('a')]
  // The rail stays out of the way of the hero ruler, which runs to the screen edge.
  new IntersectionObserver(([e]) => rail.toggleAttribute('data-hidden', e.isIntersecting)).observe(document.querySelector('.ruler')!)
  // Each number reads the surface under it, so it is light on dark sections and dark on light ones.
  const under = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const hit = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).find((n) => !rail.contains(n))
    return !!hit?.closest('.dark, .foot')
  }

  let tops: number[] = []
  let H = innerHeight
  const measure = () => {
    H = innerHeight
    const max = document.documentElement.scrollHeight - innerHeight
    tops = sections.map((s, i) => Math.min(max, i ? Math.round(s.getBoundingClientRect().top + scrollY - (head?.offsetHeight ?? 0)) : 0))
  }
  measure()
  addEventListener('resize', measure)
  addEventListener('load', measure)

  const speed = speedTracker(100)
  const lean = follow({ value: 0, time: () => (reduced.matches ? 0 : 260), onFrame: (d) => document.documentElement.style.setProperty('--lean', `${d.toFixed(2)}deg`) })
  let raf = 0
  const paint = () => {
    raf = 0
    const y = scrollY
    railNums.forEach((n, i) => n.style.setProperty('--p', pull((y - tops[i]) / H, 0.7).toFixed(3)))
    railLinks.forEach((a) => a.toggleAttribute('data-dark', under(a)))
    speed.add(y)
    lean.set(reduced.matches ? 0 : clamp(-speed.speed() / 900, -6, 6))
  }
  let calm = 0
  addEventListener(
    'scroll',
    () => {
      if (!raf) raf = requestAnimationFrame(paint)
      clearTimeout(calm)
      calm = window.setTimeout(() => lean.set(0), 120)
    },
    { passive: true },
  )
  paint()
  return page
}
