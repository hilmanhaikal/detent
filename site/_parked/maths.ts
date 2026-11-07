// Parked: the live maths panel ("How it feels, in maths"), kept to become a component later.
// Nothing on the site imports this file. It was wired to the hero ruler: call think(at) from the
// ruler scrub's onFrame and think(value, true) from onSettle, and pass the page glide callback to
// pageSettle(). The markup it fills is at the bottom of this file.

import { pull, speedTracker, type Mark, type Scrub } from '../../src/index'

export function mountMaths(marks: Mark[], reach: { reach: number; strong: number }, scrub: Scrub, ruler: HTMLElement) {
  // The maths panel: the same formulas the engine runs, filled with the ruler's numbers each frame.
  const m = (k: string) => document.querySelector<HTMLElement>(`[data-m="${k}"]`)!
  const plot = document.querySelector<HTMLElement>('.plot')!
  plot.innerHTML = Array.from({ length: 41 }, (_, i) => `<i style="--h:${pull(i / 20 - 1, 1).toFixed(3)}"></i>`).join('')
  const bars = [...plot.children] as HTMLElement[]
  const speed = speedTracker()
  let held = false
  const sizeOf = (mk: Mark) => 5 * (mk.strong ? reach.strong : reach.reach)
  // Which mark has hold of x, by the rule in attract(): a strong mark wins inside its reach, else the nearest.
  function holder(x: number) {
    let best: Mark | null = null
    for (const mk of marks) {
      const d = Math.abs(x - mk.at)
      if (d >= sizeOf(mk)) continue
      if (!best || (mk.strong && !best.strong) || (!!mk.strong === !!best.strong && d < Math.abs(x - best.at))) best = mk
    }
    return best
  }
  function think(x: number, settled = false) {
    const mk = holder(x) ?? marks.reduce((a, b) => (Math.abs(b.at - x) < Math.abs(a.at - x) ? b : a))
    const r = sizeOf(mk)
    const d = x - mk.at
    const p = holder(x) ? pull(d, r) : 0
    m('k').textContent = mk.strong ? String(reach.strong) : String(reach.reach)
    m('kind').textContent = holder(x) ? (mk.strong ? `strong mark ${mk.at}, reaches further` : `mark ${mk.at}`) : 'free: no mark in reach'
    m('d').textContent = d.toFixed(2)
    m('r').textContent = r.toFixed(2)
    m('p').textContent = p.toFixed(2)
    const lit = Math.abs(d) < r ? Math.round((d / r + 1) * 20) : -1
    bars.forEach((b, i) => b.toggleAttribute('data-on', i === lit))
    speed.add(x)
    const v = settled ? 0 : speed.speed()
    m('x').textContent = x.toFixed(2)
    m('v').textContent = v.toFixed(1)
    m('to').textContent = String(scrub.target)
    m('gapx').textContent = (x - scrub.target).toFixed(2)
    m('state').textContent = settled ? `Settled on ${scrub.target}` : held ? 'In your hand' : `Gliding to ${scrub.target}`
    m('state').toggleAttribute('data-done', settled)
  }

  ruler.addEventListener('pointerdown', () => (held = true))
  addEventListener('pointerup', () => (held = false))
  addEventListener('pointercancel', () => (held = false))
  const page = (g: { x: number; v: number; to: number; done: boolean; name: string }) => {
    m('x').textContent = `${g.x.toFixed(0)} px`
    m('v').textContent = g.v.toFixed(0)
    m('to').textContent = `${g.to.toFixed(0)} px`
    m('gapx').textContent = (g.x - g.to).toFixed(1)
    m('state').textContent = g.done ? `Page settled on ${g.name}` : `Page settling on ${g.name}`
    m('state').toggleAttribute('data-done', g.done)
  }
  return { think, page }
}

export const markup = `
      <section class="maths" id="maths" data-mark="strong" data-name="Maths" aria-labelledby="maths-h">
        <div class="maths-head">
          <h2 id="maths-h">How it feels, in maths</h2>
          <p>These are the real formulas inside detent. Drag the ruler and watch them fill in.</p>
        </div>
        <div class="eqs">
          <article class="eq">
            <h3>The pull of a mark</h3>
            <p class="f"><var>p</var> = ½ + ½ cos(π · |<var>d</var>| ⁄ <var>r</var>)</p>
            <p class="f small"><var>r</var> = <span data-m="gap">5</span> × <span data-m="k">1.2</span> <span class="note" data-m="kind">strong mark, reaches further</span></p>
            <p class="vals"><span><var>d</var> = <b data-m="d">0.00</b></span><span><var>r</var> = <b data-m="r">6.00</b></span><span><var>p</var> = <b data-m="p">1.00</b></span></p>
            <div class="plot" aria-hidden="true"></div>
          </article>
          <article class="eq">
            <h3>A glide that never flies past</h3>
            <p class="f"><var>to</var> = land(<var>x</var> + <var>v</var> · <var>c</var>), &nbsp;|<var>v</var>| ≤ <var>v</var><sub>max</sub></p>
            <p class="f small"><var>c</var> = 0.25 s, &nbsp;<var>v</var><sub>max</sub> = 140 a second</p>
            <p class="vals"><span><var>x</var> = <b data-m="x">50.00</b></span><span><var>v</var> = <b data-m="v">0.0</b></span><span><var>to</var> = <b data-m="to">50</b></span></p>
          </article>
          <article class="eq">
            <h3>A settle with no bounce</h3>
            <p class="f"><var>v</var> ← <var>v</var> + (−<var>ω</var><sup>2</sup>(<var>x</var> − <var>to</var>) − 2<var>ζ</var><var>ω</var><var>v</var>) <var>h</var></p>
            <p class="f small"><var>ω</var> = 2π ⁄ 0.28 s = 22.4, &nbsp;<var>ζ</var> = 0.88, under 1, so no overshoot</p>
            <p class="vals"><span><var>x</var> − <var>to</var> = <b data-m="gapx">0.00</b></span><span class="state" data-m="state">Settled</span></p>
          </article>
        </div>
      </section>
`
