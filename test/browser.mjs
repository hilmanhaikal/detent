// DOM behaviour in real browsers. Needs the site served on port 5182:
//   ./node_modules/.bin/vite . --config site/vite.config.ts --port 5182 --strictPort
// Then: node test/browser.mjs [chromium,firefox,webkit]
import assert from 'node:assert/strict'

const pw = await import(process.env.PLAYWRIGHT ?? '../node_modules/playwright/index.mjs')
const base = 'http://localhost:5182'
const names = (process.argv[2] ?? 'chromium,firefox').split(',')

const settled = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 4000 })
const fixture = async (page) => {
  await page.goto(`${base}/test/fixture.html`)
  await settled(page, () => window.ready)
}
// Browsers shorten a transform as they store it, so compare it the way the browser writes it.
const css = (t) => {
  const d = document.createElement('div')
  d.style.transform = t
  return d.style.transform
}
const transform = (page) => page.evaluate(() => document.getElementById('mover').style.transform)
const sameTransform = async (page, want, msg) => assert.equal(await transform(page), await page.evaluate(css, want), msg)
const attr = (page, sel, name) => page.locator(sel).getAttribute(name)

const tests = {
  async 'ruler: keys land and ARIA follows after settle'(page) {
    await page.goto(`${base}/site/index.html`)
    const ruler = page.locator('.ruler')
    await ruler.focus()
    await page.keyboard.press('ArrowRight')
    await settled(page, () => document.querySelector('.ruler').getAttribute('aria-valuenow') === '55')
    assert.equal(await attr(page, '.ruler', 'aria-valuetext'), '55')
    await page.keyboard.press('PageUp')
    await settled(page, () => document.querySelector('.ruler').getAttribute('aria-valuenow') === '75')
    await page.keyboard.press('Home')
    await settled(page, () => document.querySelector('.ruler').getAttribute('aria-valuenow') === '0')
    assert.equal(await attr(page, '.ruler', 'role'), 'slider')
    assert.equal(await attr(page, '.ruler', 'aria-orientation'), 'horizontal')
  },

  async 'ruler: a drag lands on a step of 5, moving the other way to the hand'(page) {
    await page.goto(`${base}/site/index.html`)
    const box = await page.locator('.ruler').boundingBox()
    const y = box.y + box.height / 2
    const x = box.x + box.width / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) await page.mouse.move(x - i * 13, y)
    await page.mouse.up()
    await settled(page, () => !document.querySelector('.ruler').hasAttribute('data-moving'))
    const v = Number(await attr(page, '.ruler', 'aria-valuenow'))
    assert.ok(v > 50, `went up, got ${v}`)
    assert.equal(v % 5, 0)
  },

  async 'sheet: a tap steps it up, keys go mark to mark'(page) {
    await page.goto(`${base}/site/index.html`)
    const handle = page.locator('.sh-handle')
    await handle.scrollIntoViewIfNeeded()
    await handle.click()
    await settled(page, () => document.querySelector('.sh-handle').getAttribute('aria-valuetext') === 'half')
    await handle.focus()
    await page.keyboard.press('ArrowUp')
    await settled(page, () => document.querySelector('.sh-handle').getAttribute('aria-valuetext') === 'full')
    await page.keyboard.press('Home')
    await settled(page, () => document.querySelector('.sh-handle').getAttribute('aria-valuetext') === 'peek')
  },

  async 'site: a rail link glides to its section top and focuses the heading'(page) {
    await page.goto(`${base}/site/index.html`)
    await page.evaluate(() => scrollTo(0, 700))
    await page.locator('.rail a[href="#tip"]').click()
    await settled(page, () => document.activeElement?.id === 'h-tip')
    const off = await page.evaluate(() => Math.abs(document.getElementById('tip').getBoundingClientRect().top - document.querySelector('.top').offsetHeight))
    assert.ok(off < 2, `section top under the header, off by ${off}`)
  },

  async 'events: one change per move, input while moving'(page) {
    await fixture(page)
    await page.evaluate(() => T.slider({ value: 50 }))
    assert.equal(await page.evaluate(() => log.length), 0, 'no change on create')
    await page.locator('#slider').focus()
    await page.keyboard.press('ArrowRight')
    await settled(page, () => s.value === 60 && !s.moving)
    await page.waitForTimeout(150)
    assert.deepEqual(await page.evaluate(() => log), [['slider', 'detent:change', { value: 60 }]])
    assert.ok((await page.evaluate(() => count.input)) > 1)
    await page.evaluate(() => (log.length = 0))
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await settled(page, () => s.value === 80 && !s.moving)
    await page.waitForTimeout(150)
    assert.equal(await page.evaluate(() => log.length), 1, 'two quick presses settle once')
  },

  async 'set: new marks land the value again, a new range clamps it'(page) {
    await fixture(page)
    await page.evaluate(() => T.slider({ value: 40, snap: 'marks', marks: [0, 40, 100] }))
    await page.evaluate(() => s.set({ marks: [0, 70, 100] }))
    assert.equal(await page.evaluate(() => s.value), 70)
    await page.evaluate(() => s.set({ max: 50 }))
    assert.equal(await page.evaluate(() => s.value), 50)
    assert.equal(await attr(page, '#slider', 'aria-valuemax'), '50')
  },

  async 'loop: arrows go round, spinbutton with no ends'(page) {
    await fixture(page)
    await page.evaluate(() => T.loop())
    assert.equal(await attr(page, '#loop', 'role'), 'spinbutton')
    assert.equal(await attr(page, '#loop', 'aria-valuemin'), null)
    await page.locator('#loop').focus()
    await page.keyboard.press('ArrowUp')
    await settled(page, () => l.value === 0 && !l.moving)
    assert.equal(await attr(page, '#loop', 'aria-valuenow'), '0')
    await page.keyboard.press('ArrowDown')
    await settled(page, () => l.value === 23 && !l.moving)
  },

  async 'reduced motion: same result at once, no glide'(page) {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await fixture(page)
    await page.evaluate(() => T.slider({ value: 50 }))
    await page.locator('#slider').focus()
    await page.keyboard.press('End')
    assert.equal(await page.evaluate(() => [s.value, s.at, s.moving].join()), '100,100,false')
    assert.equal(await attr(page, '#slider', 'aria-valuenow'), '100')
  },

  async 'destroy: listeners and attributes are gone'(page) {
    await fixture(page)
    await page.evaluate(() => T.slider({ value: 50 }))
    assert.equal(await attr(page, '#slider', 'role'), 'slider')
    await page.evaluate(() => s.destroy())
    for (const a of ['role', 'tabindex', 'aria-valuenow', 'aria-valuemin']) assert.equal(await attr(page, '#slider', a), null, a)
    await page.evaluate(() => document.getElementById('slider').setAttribute('tabindex', '0'))
    await page.locator('#slider').focus()
    await page.keyboard.press('End')
    const box = await page.locator('#slider').boundingBox()
    await page.mouse.move(box.x + 10, box.y + 10)
    await page.mouse.down()
    await page.mouse.move(box.x + 150, box.y + 10, { steps: 5 })
    await page.mouse.up()
    await page.waitForTimeout(400)
    assert.equal(await page.evaluate(() => [s.value, log.length].join()), '50,0')
  },

  async 'signal: aborting it destroys'(page) {
    await fixture(page)
    await page.evaluate(() => {
      window.ac = new AbortController()
      T.slider({ value: 50, signal: ac.signal })
      ac.abort()
    })
    assert.equal(await attr(page, '#slider', 'role'), null)
  },

  async '2d: a drag lands on a corner and says it'(page) {
    await fixture(page)
    await page.evaluate(() => T.pip())
    const vp = page.viewportSize()
    assert.deepEqual(await page.evaluate(() => p.at), { x: 16, y: 16 })
    await page.mouse.move(60, 50)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) await page.mouse.move(60 + i * (vp.width / 14), 50 + i * (vp.height / 14))
    await page.mouse.up()
    await settled(page, () => !p.moving && p.index === 3)
    const at = await page.evaluate(() => p.at)
    assert.ok(Math.abs(at.x - (vp.width - 116)) < 1 && Math.abs(at.y - (vp.height - 76)) < 1, JSON.stringify(at))
    await settled(page, () => document.querySelector('[data-detent-voice]')?.textContent === 'Bottom right')
    assert.equal(await attr(page, '[data-detent-voice]', 'aria-live'), 'polite')
    assert.equal(await page.evaluate(() => log.filter((l) => l[1] === 'detent2d:change').length), 1)
  },

  async '2d: arrow keys go to the next corner that way'(page) {
    await fixture(page)
    await page.evaluate(() => T.pip({ value: 3 }))
    await page.locator('#pip').focus()
    await page.keyboard.press('ArrowLeft')
    await settled(page, () => !p.moving && p.index === 2)
    await page.keyboard.press('ArrowUp')
    await settled(page, () => !p.moving && p.index === 0)
    await settled(page, () => document.querySelector('[data-detent-voice]')?.textContent === 'Top left')
    await page.evaluate(() => p.destroy())
    assert.equal(await page.locator('[data-detent-voice]').count(), 0, 'the live region goes with the last user')
  },

  async '2d: set() during a glide keeps the change and lands on the new point'(page) {
    await fixture(page)
    await page.evaluate(() => T.pip())
    await page.locator('#pip').focus()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(40)
    await page.evaluate(() => p.set({ points: [{ x: 16, y: 16, name: 'Home' }, { x: 200, y: 120, name: 'Dock' }] }))
    await settled(page, () => !p.moving && p.index === 1)
    await page.waitForTimeout(100)
    assert.deepEqual(await page.evaluate(() => p.at), { x: 200, y: 120 })
    assert.deepEqual(await page.evaluate(() => log.filter((l) => l[1] === 'detent2d:change').map((l) => l[2].point.name)), ['Dock'])
  },

  async '2d: announce can be turned off'(page) {
    await fixture(page)
    await page.evaluate(() => T.pip({ announce: false }))
    await page.locator('#pip').focus()
    await page.keyboard.press('ArrowRight')
    await settled(page, () => !p.moving && p.index === 1)
    await page.waitForTimeout(150)
    assert.equal(await page.locator('[data-detent-voice]').count(), 0)
  },

  async 'scroll: never moves while the wheel is going, then settles on a top'(page) {
    await fixture(page)
    await page.evaluate(() => T.scroll())
    await page.mouse.move(200, 200)
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, 37)
      await page.waitForTimeout(60)
      assert.equal(await page.evaluate(() => scrollLog.input), 0, 'no settle frame while the hand is moving')
    }
    await settled(page, () => scrollLog.change.length === 1 && Math.abs(scrollY - [...document.querySelectorAll('[data-mark]')][scrollLog.change[0]].offsetTop) < 1)
    assert.ok((await page.evaluate(() => sc.index)) !== null)
  },

  async 'scroll: reduced motion means no settle'(page) {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await fixture(page)
    await page.evaluate(() => T.scroll())
    await page.mouse.move(200, 200)
    await page.mouse.wheel(0, 150)
    await page.waitForTimeout(600)
    assert.deepEqual(await page.evaluate(() => [scrollLog.input, scrollLog.change.length]), [0, 0])
  },

  async 'scroll: destroy stops the settle'(page) {
    await fixture(page)
    await page.evaluate(() => {
      T.scroll()
      sc.destroy()
    })
    await page.mouse.move(200, 200)
    await page.mouse.wheel(0, 150)
    await page.waitForTimeout(600)
    assert.equal(await page.evaluate(() => scrollLog.change.length), 0)
  },

  async 'scroll: after a touch settles, a native scroll is left alone'(page) {
    await fixture(page)
    await page.evaluate(() => T.scroll())
    await page.evaluate(() => {
      T.touch('touchstart', 1)
      scrollTo(0, 300)
      T.touch('touchend', 0)
    })
    await settled(page, () => scrollLog.change.length === 1)
    await page.waitForTimeout(1200)
    await page.evaluate(() => scrollTo(0, 1100))
    await page.waitForTimeout(800)
    assert.deepEqual(await page.evaluate(() => [scrollY, scrollLog.change.length]), [1100, 1])
  },

  async 'scroll: no settle while a second finger is still down'(page) {
    await fixture(page)
    await page.evaluate(() => T.scroll())
    await page.evaluate(() => {
      T.touch('touchstart', 2)
      scrollTo(0, 300)
      T.touch('touchend', 1)
    })
    await page.waitForTimeout(600)
    assert.deepEqual(await page.evaluate(() => [scrollY, scrollLog.input]), [300, 0])
    await page.evaluate(() => T.touch('touchend', 0))
    await settled(page, () => scrollLog.change.length === 1)
  },

  async 'scroll: destroy takes back the tabindex it gave a heading'(page) {
    await fixture(page)
    await page.evaluate(() => T.scroll())
    await page.locator('#toc').click()
    await settled(page, () => document.activeElement?.textContent === 'C')
    assert.equal(await attr(page, '#c h2', 'tabindex'), '-1')
    await page.evaluate(() => sc.destroy())
    assert.equal(await attr(page, '#c h2', 'tabindex'), null)
  },

  async 'empty lists do nothing and do not throw'(page) {
    await fixture(page)
    await page.evaluate(() => {
      const s = detentScrollEmpty()
      s.go(0)
      s.destroy()
      T.pip({ points: [] })
      p.go(0)
    })
    await page.locator('#pip').focus()
    await page.keyboard.press('ArrowRight')
    const box = await page.locator('#pip').boundingBox()
    await page.mouse.move(box.x + 5, box.y + 5)
    await page.mouse.down()
    await page.mouse.move(box.x + 80, box.y + 80, { steps: 4 })
    await page.mouse.up()
    await page.waitForTimeout(200)
  },

  async 'loop: the live position is not rounded and stays inside the loop'(page) {
    await fixture(page)
    await page.evaluate(() => T.loop())
    const box = await page.locator('#loop').boundingBox()
    const y = box.y + box.height / 2
    await page.mouse.move(box.x + 20, y)
    await page.mouse.down()
    await page.mouse.move(box.x + 35, y, { steps: 3 })
    const at = await page.evaluate(() => l.at)
    await page.mouse.up()
    assert.ok(at > 0 && at < 1, `between the last row and the first, got ${at}`)
    await settled(page, () => !l.moving)
    const v = await page.evaluate(() => l.value)
    assert.ok(Number.isInteger(v) && v >= 0 && v < 24, `rests on a row inside the loop, got ${v}`)
  },

  async '2d: grabbed mid-glide and put back, no change'(page) {
    await fixture(page)
    await page.evaluate(() => T.pip({ period: 4000 }))
    await page.locator('#pip').focus()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)
    const box = await page.locator('#pip').boundingBox()
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    // Back to where it started, then a still moment, so the let-go has no flick.
    await page.mouse.move(x - (box.x - 16), y, { steps: 8 })
    await page.waitForTimeout(200)
    await page.mouse.up()
    await settled(page, () => !p.moving)
    assert.equal(await page.evaluate(() => p.index), 0)
    assert.equal(await page.evaluate(() => log.filter((l) => l[1] === 'detent2d:change').length), 0)
  },

  async '2d: a plain element gets a group role and the live region is ready'(page) {
    await fixture(page)
    await page.evaluate(() => T.pip())
    assert.equal(await attr(page, '#pip', 'role'), 'group')
    assert.equal(await attr(page, '#pip', 'aria-roledescription'), 'movable')
    assert.equal(await page.locator('[data-detent-voice]').count(), 1)
    await page.evaluate(() => p.destroy())
    assert.equal(await attr(page, '#pip', 'role'), null)
  },
  async 'throw: a slow short drag springs back, a long drag throws once'(page) {
    await fixture(page)
    await page.evaluate(() => T.throw())
    const box = await page.locator('#card').boundingBox()
    const x = box.x + 150
    const y = box.y + 120
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(x + i * 10, y)
      await page.waitForTimeout(40)
    }
    await page.waitForTimeout(150)
    await page.mouse.up()
    await settled(page, () => !t.moving && t.at.x === 0)
    assert.equal(await page.evaluate(() => [t.thrown, seen('detentthrow:throw')].join()), ',0')
    await page.mouse.move(x, y)
    await page.mouse.down()
    for (let i = 1; i <= 15; i++) {
      await page.mouse.move(x + i * 10, y)
      await page.waitForTimeout(30)
    }
    assert.equal(await attr(page, '#card', 'data-armed'), 'right')
    await page.waitForTimeout(150)
    await page.mouse.up()
    await settled(page, () => t.thrown === 'right' && !t.moving)
    await page.waitForTimeout(150)
    assert.equal(await page.evaluate(() => seen('detentthrow:throw')), 1)
    assert.equal(await attr(page, '#card', 'data-thrown'), 'right')
    assert.ok((await page.evaluate(() => t.at.x)) > 300, 'flown off')
  },

  async 'throw: a fast short flick stays, a fast flick past 40 px goes'(page) {
    await fixture(page)
    await page.evaluate(() => T.throw({ directions: ['left', 'right'] }))
    const box = await page.locator('#card').boundingBox()
    const x = box.x + 150
    const y = box.y + 120
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 30, y, { steps: 3 })
    await page.mouse.up()
    await settled(page, () => !t.moving)
    assert.equal(await page.evaluate(() => t.thrown), null)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 70, y, { steps: 3 })
    await page.mouse.up()
    await settled(page, () => t.thrown === 'left' && !t.moving)
    assert.equal(await page.evaluate(() => seen('detentthrow:throw')), 1)
  },

  async 'throw: a drag that ends on a button is not a click on it'(page) {
    await fixture(page)
    await page.evaluate(() => T.throw())
    const box = await page.locator('#inside').boundingBox()
    await page.mouse.move(box.x + 5, box.y + 5)
    await page.mouse.down()
    await page.mouse.move(box.x + 25, box.y + 5, { steps: 4 })
    await page.mouse.move(box.x + 5, box.y + 5, { steps: 4 })
    await page.mouse.up()
    await settled(page, () => !t.moving)
    assert.equal(await page.evaluate(() => seen('inside:click')), 0)
    await page.waitForTimeout(50)
    await page.mouse.down()
    await page.mouse.move(box.x + 7, box.y + 6)
    await page.mouse.up()
    assert.equal(await page.evaluate(() => seen('inside:click')), 1, 'a tap with a little jitter still clicks')
    await page.locator('#inside').focus()
    await page.keyboard.press('Enter')
    assert.equal(await page.evaluate(() => seen('inside:click')), 2, 'a key click after a drag is not eaten')
  },

  async 'throw: pointercancel springs back and never throws'(page) {
    await fixture(page)
    await page.evaluate(() => T.throw())
    const box = await page.locator('#card').boundingBox()
    const x = box.x + 150
    const y = box.y + 120
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 200, y, { steps: 8 })
    await page.evaluate(() => document.getElementById('card').dispatchEvent(new PointerEvent('pointercancel', { pointerId: lastPointer, bubbles: true })))
    await page.mouse.up()
    await settled(page, () => !t.moving && t.at.x === 0)
    await page.waitForTimeout(200)
    assert.equal(await page.evaluate(() => [t.thrown, seen('detentthrow:throw')].join()), ',0')
  },

  async 'throw: throw() during a throw never fires twice, one during undo plays once after it'(page) {
    await fixture(page)
    await page.evaluate(() => T.throw())
    await page.evaluate(() => (t.throw('left'), t.throw('left'), t.throw('right')))
    await settled(page, () => t.thrown === 'left' && !t.moving)
    await page.waitForTimeout(200)
    assert.equal(await page.evaluate(() => seen('detentthrow:throw')), 1)
    await page.evaluate(() => (t.undo(), t.throw('right'), t.throw('right')))
    await settled(page, () => t.thrown === 'right' && !t.moving)
    await page.waitForTimeout(200)
    assert.deepEqual(await page.evaluate(() => ev.filter((e) => e[0] === 'detentthrow:throw').map((e) => e[1].direction)), ['left', 'right'])
    await page.evaluate(() => t.undo({ instant: true }))
    assert.deepEqual(await page.evaluate(() => [t.thrown, t.at.x, t.at.y]), [null, 0, 0])
    assert.equal(await attr(page, '#card', 'data-thrown'), null)
  },

  async 'throw: reduced motion throws and undoes at once, same results'(page) {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await fixture(page)
    await page.evaluate(() => T.throw())
    assert.deepEqual(await page.evaluate(() => (t.throw('left'), [t.thrown, t.moving, seen('detentthrow:throw')])), ['left', false, 1])
    assert.ok((await page.evaluate(() => t.at.x)) < -300)
    assert.deepEqual(await page.evaluate(() => (t.undo(), [t.thrown, t.at.x])), [null, 0])
    const box = await page.locator('#card').boundingBox()
    await page.mouse.move(box.x + 150, box.y + 120)
    await page.mouse.down()
    await page.mouse.move(box.x + 300, box.y + 120, { steps: 6 })
    await page.waitForTimeout(150)
    await page.mouse.up()
    assert.equal(await page.evaluate(() => t.thrown), 'right')
  },

  async 'throw: a tick past the line, and destroy and signal clean up'(page) {
    await fixture(page)
    await page.evaluate(() => T.throw({ haptics: true, cssVar: ['--x', '--y', '--tilt'] }))
    const box = await page.locator('#card').boundingBox()
    await page.mouse.move(box.x + 150, box.y + 120)
    await page.mouse.down()
    await page.mouse.move(box.x + 300, box.y + 120, { steps: 10 })
    assert.deepEqual(await page.evaluate(() => buzz), [12])
    await page.mouse.move(box.x + 150, box.y + 120, { steps: 10 })
    await page.waitForTimeout(150)
    await page.mouse.up()
    await settled(page, () => !t.moving)
    await page.evaluate(() => t.destroy())
    assert.equal(await page.evaluate(() => ['--x', '--y', '--tilt'].map((n) => document.getElementById('card').style.getPropertyValue(n)).join('')), '')
    await page.mouse.move(box.x + 150, box.y + 120)
    await page.mouse.down()
    await page.mouse.move(box.x + 350, box.y + 120, { steps: 10 })
    await page.mouse.up()
    await page.evaluate(() => t.throw('left'))
    await page.waitForTimeout(400)
    assert.deepEqual(await page.evaluate(() => [t.thrown, seen('detentthrow:throw'), buzz.length]), [null, 0, 1])
    assert.equal(await attr(page, '#card', 'data-armed'), null)
    assert.equal(await page.evaluate(() => {
      const ac = new AbortController()
      T.throw({ signal: ac.signal })
      ac.abort()
      t.throw('left')
      return t.thrown
    }), null)
  },

  async 'pull: past the line it arms, and letting go fires once and holds until done()'(page) {
    await fixture(page)
    await page.evaluate(() => T.pull({ haptics: true }))
    const box = await page.locator('#list').boundingBox()
    const x = box.x + 150
    const y = box.y + 20
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 130, { steps: 12 })
    assert.equal(await attr(page, '#list', 'data-armed'), '')
    assert.deepEqual(await page.evaluate(() => [pl.armed, seen('detentpull:arm'), buzz]), [true, 1, [12]])
    await page.mouse.up()
    await settled(page, () => !pl.moving && Math.abs(pl.distance - 64) < 0.01)
    assert.deepEqual(await page.evaluate(() => [pl.busy, pl.armed, seen('detentpull:pull')]), [true, false, 1])
    assert.equal(await attr(page, '#list', 'aria-busy'), 'true')
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 130, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    assert.equal(await page.evaluate(() => seen('detentpull:pull')), 1, 'no second pull while busy')
    await page.evaluate(() => pl.done())
    await settled(page, () => pl.distance === 0)
    assert.equal(await attr(page, '#list', 'aria-busy'), null)
  },

  async 'pull: a short pull springs back, and a list scrolled down never pulls'(page) {
    await fixture(page)
    await page.evaluate(() => T.pull())
    const box = await page.locator('#list').boundingBox()
    const x = box.x + 150
    const y = box.y + 20
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 50, { steps: 6 })
    assert.ok((await page.evaluate(() => pl.distance)) > 20, 'it follows the hand')
    await page.mouse.up()
    await settled(page, () => pl.distance === 0)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 30, { steps: 3 })
    await page.mouse.move(x, y - 20, { steps: 3 })
    assert.deepEqual(await page.evaluate(() => [pl.distance, pl.armed]), [0, false], 'pushed back past the start, the pull lets go')
    await page.mouse.up()
    await page.evaluate(() => (document.getElementById('list').scrollTop = 100))
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 150, { steps: 10 })
    assert.equal(await page.evaluate(() => pl.distance), 0)
    await page.mouse.up()
    await page.waitForTimeout(200)
    assert.deepEqual(await page.evaluate(() => [seen('detentpull:arm'), seen('detentpull:pull')]), [0, 0])
  },

  async 'pull: trigger() for a button, once while busy, and reduced motion keeps results'(page) {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await fixture(page)
    await page.evaluate(() => T.pull({ rest: 48 }))
    assert.deepEqual(await page.evaluate(() => (pl.trigger(), pl.trigger(), [pl.busy, pl.distance, seen('detentpull:pull')])), [true, 48, 1])
    assert.deepEqual(await page.evaluate(() => (pl.done(), [pl.busy, pl.distance])), [false, 0])
    const box = await page.locator('#list').boundingBox()
    await page.mouse.move(box.x + 150, box.y + 20)
    await page.mouse.down()
    await page.mouse.move(box.x + 150, box.y + 160, { steps: 12 })
    await page.mouse.up()
    assert.deepEqual(await page.evaluate(() => [pl.busy, pl.distance, seen('detentpull:pull')]), [true, 48, 2])
    await page.evaluate(() => pl.destroy())
    for (const a of ['aria-busy', 'data-busy', 'data-armed']) assert.equal(await attr(page, '#list', a), null, a)
    assert.equal(await page.evaluate(() => document.getElementById('list').style.getPropertyValue('--pull')), '')
  },

  async 'touch: a pull at the top pulls, a swipe up scrolls natively'(page, name) {
    if (name !== 'chromium') return
    await fixture(page)
    await page.evaluate(() => T.pull())
    const box = await page.locator('#list').boundingBox()
    const x = box.x + 150
    const client = await page.context().newCDPSession(page)
    const swipe = async (from, to) => {
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: from }] })
      for (let i = 1; i <= 10; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: from + ((to - from) * i) / 10 }] })
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    await swipe(box.y + 150, box.y + 20)
    await page.waitForTimeout(400)
    assert.ok((await page.evaluate(() => document.getElementById('list').scrollTop)) > 0, 'the list scrolled')
    assert.deepEqual(await page.evaluate(() => [pl.distance, seen('detentpull:pull')]), [0, 0])
    await page.evaluate(() => (document.getElementById('list').scrollTop = 0))
    await swipe(box.y + 20, box.y + 180)
    await settled(page, () => pl.busy && !pl.moving)
    assert.equal(await page.evaluate(() => [seen('detentpull:pull'), document.getElementById('list').scrollTop].join()), '1,0')
  },

  async 'hold: a tap never confirms but calls onTap'(page) {
    await fixture(page)
    await page.evaluate(() => T.hold())
    await page.locator('#hold').click()
    await settled(page, () => seen('detenthold:tap') === 1)
    await page.waitForTimeout(300)
    assert.deepEqual(await page.evaluate(() => [seen('detenthold:tap'), seen('detenthold:confirm'), h.done]), [1, 0, false])
    await page.evaluate(() => document.getElementById('hold').click())
    assert.equal(await page.evaluate(() => seen('detenthold:tap')), 2, 'a click with no press, as from a screen reader, is a tap')
  },

  async 'hold: a full hold confirms once, an early let-go does not'(page) {
    await fixture(page)
    await page.evaluate(() => T.hold({ haptics: true }))
    const box = await page.locator('#hold').boundingBox()
    await page.mouse.move(box.x + 100, box.y + 24)
    await page.mouse.down()
    await page.waitForTimeout(600)
    await page.mouse.up()
    await settled(page, () => h.progress === 0)
    assert.deepEqual(await page.evaluate(() => [seen('detenthold:confirm'), seen('detenthold:cancel'), seen('detenthold:tap')]), [0, 1, 0])
    await page.mouse.down()
    await page.waitForTimeout(1000)
    assert.equal(await page.evaluate(() => h.done), false, 'not before its time')
    await settled(page, () => h.done)
    await page.waitForTimeout(400)
    await page.mouse.up()
    await page.waitForTimeout(300)
    assert.deepEqual(await page.evaluate(() => [seen('detenthold:confirm'), seen('detenthold:tap'), h.progress, buzz]), [1, 0, 1, [12]])
    assert.equal(await attr(page, '#hold', 'data-done'), '')
    await page.mouse.down()
    await page.waitForTimeout(1700)
    await page.mouse.up()
    assert.equal(await page.evaluate(() => seen('detenthold:confirm')), 1, 'done stays done until reset()')
    await page.evaluate(() => h.reset())
    assert.deepEqual(await page.evaluate(() => [h.done, h.progress]), [false, 0])
  },

  async 'hold: moving far off cancels'(page) {
    await fixture(page)
    await page.evaluate(() => T.hold({ time: 600 }))
    const box = await page.locator('#hold').boundingBox()
    await page.mouse.move(box.x + 100, box.y + 24)
    await page.mouse.down()
    await page.waitForTimeout(200)
    await page.mouse.move(box.x + 100, box.y + 120, { steps: 3 })
    await page.waitForTimeout(800)
    await page.mouse.up()
    assert.deepEqual(await page.evaluate(() => [seen('detenthold:confirm'), seen('detenthold:cancel'), h.progress]), [0, 1, 0])
  },

  async 'hold: one key press is a tap, a held key confirms'(page) {
    await fixture(page)
    await page.evaluate(() => T.hold({ time: 600 }))
    await page.locator('#hold').focus()
    await page.keyboard.press('Enter')
    assert.deepEqual(await page.evaluate(() => [seen('detenthold:tap'), seen('detenthold:confirm')]), [1, 0])
    await page.keyboard.down(' ')
    await settled(page, () => h.done)
    await page.keyboard.up(' ')
    await page.waitForTimeout(200)
    assert.deepEqual(await page.evaluate(() => [seen('detenthold:tap'), seen('detenthold:confirm')]), [1, 1])
  },

  async 'hold: reduced motion keeps the clock, the rewind jumps; destroy cleans up'(page) {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await fixture(page)
    await page.evaluate(() => T.hold({ time: 500 }))
    const box = await page.locator('#hold').boundingBox()
    await page.mouse.move(box.x + 100, box.y + 24)
    await page.mouse.down()
    await page.waitForTimeout(300)
    await page.mouse.up()
    assert.equal(await page.evaluate(() => h.progress), 0)
    await page.mouse.down()
    await settled(page, () => h.done)
    await page.mouse.up()
    assert.equal(await page.evaluate(() => seen('detenthold:confirm')), 1)
    await page.evaluate(() => h.destroy())
    assert.equal(await attr(page, '#hold', 'data-done'), null)
    assert.equal(await page.evaluate(() => document.getElementById('hold').style.getPropertyValue('--progress')), '')
    await page.evaluate(() => {
      const ac = new AbortController()
      T.hold({ time: 300, signal: ac.signal })
      ac.abort()
    })
    await page.mouse.down()
    await page.waitForTimeout(500)
    await page.mouse.up()
    await page.locator('#hold').click()
    assert.deepEqual(await page.evaluate(() => [seen('detenthold:confirm'), seen('detenthold:tap')]), [1, 0])
  },

  async '3d: turntable keys land on views, the slider value follows'(page) {
    await fixture(page)
    await page.evaluate(() => T.table())
    for (const [n, v] of [['role', 'slider'], ['tabindex', '0'], ['aria-valuemin', '0'], ['aria-valuemax', '7'], ['aria-valuenow', '0'], ['aria-valuetext', 'Front'], ['aria-orientation', 'horizontal']]) assert.equal(await attr(page, '#table', n), v, n)
    await page.locator('#table').focus()
    await page.keyboard.press('ArrowRight')
    await settled(page, () => !t3.moving && t3.index === 1)
    assert.equal(await attr(page, '#table', 'aria-valuetext'), '45 degrees')
    assert.equal(await page.evaluate(() => t3.rotation.yaw), 45)
    await page.keyboard.press('PageUp')
    await settled(page, () => !t3.moving && t3.index === 3)
    await page.keyboard.press('End')
    await settled(page, () => !t3.moving && t3.index === 7)
    await page.keyboard.press('ArrowRight')
    await settled(page, () => !t3.moving && t3.index === 0)
    assert.equal(await page.evaluate(() => t3.rotation.yaw), 360, 'goes round forward, the short way')
    await page.keyboard.press('ArrowLeft')
    await settled(page, () => !t3.moving && t3.index === 7)
    assert.equal(await page.evaluate(() => t3.rotation.yaw), 315)
    assert.equal(await page.evaluate(() => seen('detent3d:change')), 5)
    assert.equal(await page.locator('[data-detent-voice]').count(), 0, 'a slider speaks through its value, not the live region')
  },

  async '3d: cube arrows turn to the next face that way and say it'(page) {
    await fixture(page)
    await page.evaluate(() => T.cube())
    assert.equal(await attr(page, '#cube', 'role'), 'group')
    assert.equal(await attr(page, '#cube', 'aria-roledescription'), 'rotatable')
    await page.locator('#cube').focus()
    await page.keyboard.press('ArrowRight')
    await settled(page, () => !c3.moving && c3.index === 3)
    await settled(page, () => document.querySelector('[data-detent-voice]')?.textContent === 'Left')
    const q = await page.evaluate(() => c3.quaternion)
    assert.ok(Math.abs(q[1] - Math.SQRT1_2) < 1e-9 && Math.abs(q[3] - Math.SQRT1_2) < 1e-9, `three.js quaternion for yaw 90: ${q}`)
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('cube')).getPropertyValue('--yaw').trim()), '90.000')
    await page.keyboard.press('ArrowRight')
    await settled(page, () => !c3.moving && c3.index === 2)
    await page.keyboard.press('Home')
    await settled(page, () => !c3.moving && c3.index === 0)
    await page.keyboard.press('ArrowDown')
    await settled(page, () => !c3.moving && c3.index === 4)
    await settled(page, () => document.querySelector('[data-detent-voice]')?.textContent === 'Top')
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowUp')
    await settled(page, () => !c3.moving && c3.index === 5)
    assert.deepEqual(await page.evaluate(() => c3.rotation), { yaw: 0, pitch: 90, roll: 0 })
  },

  async '3d: a drag lands on a face, a quick flick carries further'(page) {
    await fixture(page)
    await page.evaluate(() => T.table())
    await page.locator('#table').scrollIntoViewIfNeeded()
    const box = await page.locator('#table').boundingBox()
    const y = box.y + 80
    await page.mouse.move(box.x + 20, y)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 20 + i * 10, y)
    await page.waitForTimeout(200)
    await page.mouse.up()
    await settled(page, () => !t3.moving && t3.index === 1)
    assert.equal(await page.evaluate(() => t3.rotation.yaw), 45, 'a slow 100 px drag is 50 degrees: the 45 view')
    await page.evaluate(() => T.cube())
    await page.locator('#cube').scrollIntoViewIfNeeded()
    const cb = await page.locator('#cube').boundingBox()
    await page.mouse.move(cb.x + 80, cb.y + 10)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) await page.mouse.move(cb.x + 80, cb.y + 10 + i * 18)
    await page.waitForTimeout(200)
    await page.mouse.up()
    await settled(page, () => !c3.moving && c3.index === 4)
    await settled(page, () => document.querySelector('[data-detent-voice]')?.textContent === 'Top')
    await page.mouse.move(cb.x + 20, cb.y + 80)
    await page.mouse.down()
    for (let i = 1; i <= 4; i++) await page.mouse.move(cb.x + 20 + i * 25, cb.y + 80)
    await page.mouse.up()
    await settled(page, () => !c3.moving)
    assert.notEqual(await page.evaluate(() => c3.index), 4, 'a flick right turns it off the top')
  },

  async '3d: one change per move, none for a grab put back or a tap'(page) {
    await fixture(page)
    await page.evaluate(() => T.table())
    await page.locator('#table').focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await settled(page, () => !t3.moving && t3.index === 2)
    await page.waitForTimeout(150)
    assert.deepEqual(await page.evaluate(() => ev.filter((e) => e[0] === 'detent3d:change').map((e) => e[1].index)), [2])
    await page.locator('#table').scrollIntoViewIfNeeded()
    const box = await page.locator('#table').boundingBox()
    await page.mouse.click(box.x + 80, box.y + 80)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(60)
    await page.mouse.move(box.x + 80, box.y + 80)
    await page.mouse.down()
    await page.mouse.up()
    await settled(page, () => !t3.moving)
    await page.waitForTimeout(150)
    const changes = await page.evaluate(() => ev.filter((e) => e[0] === 'detent3d:change').map((e) => e[1].index))
    assert.ok(changes.length <= 2 && changes[0] === 2, JSON.stringify(changes))
    assert.equal(new Set(changes).size, changes.length, 'never the same face twice in a row')
  },

  async '3d: reduced motion lands at once and keeps every result'(page) {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await fixture(page)
    await page.evaluate(() => T.cube())
    await page.locator('#cube').focus()
    await page.keyboard.press('ArrowLeft')
    assert.deepEqual(await page.evaluate(() => [c3.index, c3.moving, c3.rotation.yaw]), [1, false, -90])
    await page.evaluate(() => T.table({ value: 2 }))
    await page.locator('#table').focus()
    await page.keyboard.press('ArrowRight')
    assert.deepEqual(await page.evaluate(() => [t3.index, t3.moving]), [3, false])
    assert.equal(await attr(page, '#table', 'aria-valuetext'), '135 degrees')
    await page.locator('#table').scrollIntoViewIfNeeded()
    const box = await page.locator('#table').boundingBox()
    await page.mouse.move(box.x + 10, box.y + 80)
    await page.mouse.down()
    await page.mouse.move(box.x + 70, box.y + 80, { steps: 3 })
    await page.mouse.up()
    assert.deepEqual(await page.evaluate(() => [t3.index, t3.moving, t3.rotation.yaw]), [4, false, 180], 'a flick lands under the hand, with no coast')
  },

  async '3d: from the back, up and down still reach the bottom and the top'(page) {
    await fixture(page)
    await page.evaluate(() => T.cube({ value: 2 }))
    await page.locator('#cube').focus()
    await page.keyboard.press('ArrowUp')
    await settled(page, () => !c3.moving && c3.index === 5)
    await page.keyboard.press('ArrowDown')
    await settled(page, () => !c3.moving && c3.index === 2)
    await page.keyboard.press('ArrowDown')
    await settled(page, () => !c3.moving && c3.index === 4)
    await page.evaluate(() => c3.go(2, { instant: true }))
    await page.locator('#cube').scrollIntoViewIfNeeded()
    const cb = await page.locator('#cube').boundingBox()
    await page.mouse.move(cb.x + 80, cb.y + 150)
    await page.mouse.down()
    for (let i = 1; i <= 9; i++) await page.mouse.move(cb.x + 80, cb.y + 150 - i * 18)
    await page.waitForTimeout(200)
    await page.mouse.up()
    await settled(page, () => !c3.moving && c3.index === 5)
  },

  async '3d: set() during a glide keeps the change; one axis keys follow the turning order'(page) {
    await fixture(page)
    await page.evaluate(() => T.table())
    await page.locator('#table').focus()
    await page.keyboard.press('ArrowRight')
    await page.evaluate(() => t3.set({ onChange: () => {} }))
    await settled(page, () => !t3.moving && t3.index === 1)
    await page.waitForTimeout(100)
    assert.equal(await page.evaluate(() => seen('detent3d:change')), 1)
    await page.evaluate(() => {
      t3.destroy()
      T.table({ faces: [{ yaw: 0, name: 'Front' }, { yaw: 180, name: 'Back' }, { yaw: 90, name: 'Side' }], axes: 'yaw' })
    })
    await page.locator('#table').focus()
    await page.keyboard.press('ArrowRight')
    await settled(page, () => !t3.moving && t3.index === 2)
    assert.deepEqual([await attr(page, '#table', 'aria-valuenow'), await attr(page, '#table', 'aria-valuetext')], ['1', 'Side'])
    await page.keyboard.press('End')
    await settled(page, () => !t3.moving && t3.index === 1)
    assert.equal(await attr(page, '#table', 'aria-valuenow'), '2')
  },

  async '3d docs: the cube and the card flip run from their shown files'(page) {
    await page.goto(`${base}/site/docs/3d.html`)
    await page.locator('#cube').focus()
    await page.keyboard.press('ArrowLeft')
    await settled(page, () => document.getElementById('cube-out').textContent === 'Right')
    await settled(page, () => document.querySelector('[data-voice-echo]').textContent === 'Right')
    await page.locator('#lamp').focus()
    await page.keyboard.press('End')
    await settled(page, () => document.getElementById('lamp').getAttribute('aria-valuetext') === 'Front and right side')
    await page.goto(`${base}/site/docs/recipes.html`)
    await page.locator('#r-flip-button').click()
    await settled(page, () => document.getElementById('r-flip').getAttribute('aria-valuetext') === 'Meaning: lasting a very short time')
  },

  async '3d: destroy and signal put everything back'(page) {
    await fixture(page)
    await page.evaluate(() => {
      document.getElementById('cube').setAttribute('tabindex', '-1')
      T.cube()
    })
    assert.equal(await page.evaluate(() => document.getElementById('cube').style.touchAction), 'none')
    assert.equal(await page.evaluate(() => document.body.style.touchAction), '', 'never on the page')
    await page.evaluate(() => c3.destroy())
    for (const a of ['role', 'aria-roledescription', 'data-moving']) assert.equal(await attr(page, '#cube', a), null, a)
    assert.equal(await attr(page, '#cube', 'tabindex'), '-1', 'a tabindex it found stays')
    assert.equal(await page.evaluate(() => document.getElementById('cube').getAttribute('style')), '')
    assert.equal(await page.locator('[data-detent-voice]').count(), 0)
    await page.locator('#cube').focus()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(400)
    assert.deepEqual(await page.evaluate(() => [c3.index, seen('detent3d:change')]), [0, 0])
    await page.evaluate(() => {
      const ac = new AbortController()
      T.table({ signal: ac.signal })
      ac.abort()
    })
    for (const a of ['role', 'tabindex', 'aria-valuenow', 'aria-valuetext', 'aria-orientation']) assert.equal(await attr(page, '#table', a), null, a)
    await page.locator('#table').focus()
    await page.keyboard.press('End')
    await page.waitForTimeout(300)
    assert.equal(await page.evaluate(() => t3.index), 0)
  },

  async 'animate: x, y, scale and rotate compose into one transform'(page) {
    await fixture(page)
    const opacity = await page.evaluate(async () => {
      await animate(mover, { to: { x: 100, y: 20, scale: 2, rotate: 90 }, duration: 120 }).finished
      await animate(mover, { to: { x: 60, opacity: 0.5 }, period: 200 }).finished
      return mover.style.opacity
    })
    await sameTransform(page, 'translate(60px, 20px) rotate(90deg) scale(2)', 'a later x keeps y, scale and rotate')
    assert.equal(opacity, '0.5')
    const box = await page.locator('#mover').boundingBox()
    assert.ok(Math.abs(box.width - 80) < 0.5 && Math.abs(box.x + 20 - 60) < 0.5, `drawn at ${box.x}, ${box.width} wide`)
    const custom = await page.evaluate(async () => {
      await animate(mover, { to: { '--fill': 0.75 }, duration: 60 }).finished
      return getComputedStyle(mover).getPropertyValue('--fill')
    })
    assert.equal(Number(custom), 0.75)
  },

  async 'animate: never layout, and says so in the console'(page) {
    await fixture(page)
    const warnings = []
    page.on('console', (m) => m.type() === 'warning' && warnings.push(m.text()))
    await page.evaluate(() => animate(mover, { to: { width: 300, x: 10 }, duration: 30 }).finished)
    assert.equal(await page.evaluate(() => mover.style.width), '')
    await sameTransform(page, 'translate(10px, 0px) rotate(0deg) scale(1)')
    assert.ok(warnings.some((w) => w.includes('width')), 'a warning names the property')
  },

  async 'animate: reduced motion lands on the end state at once, with onUpdate and onDone'(page) {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await fixture(page)
    const got = await page.evaluate(() => {
      const seen = []
      const a = animate(mover, { to: { x: 50, opacity: 0.4 }, delay: 400, onUpdate: (v) => seen.push(v.x), onDone: () => seen.push('done') })
      return a.finished.then((landed) => [mover.style.opacity, seen, landed, a.progress])
    })
    assert.deepEqual(got, ['0.4', [50, 'done'], true, 1])
    await sameTransform(page, 'translate(50px, 0px) rotate(0deg) scale(1)')
    const tl = await page.evaluate(() => {
      const box = { x: 0 }
      const t = timeline({ paused: true }).add(box, { to: { x: 10 }, duration: 800 })
      t.play()
      const end = box.x
      t.seek(400)
      return [end, box.x]
    })
    assert.equal(tl[0], 10, 'play lands on the end')
    assert.ok(tl[1] > 0 && tl[1] < 10, 'seek still scrubs')
  },

  async 'animate: a hidden tab pauses it, and it resumes where it was'(page) {
    await fixture(page)
    await page.evaluate(() => (window.a = animate(mover, { to: { x: 200 }, duration: 600, ease: 'linear' })))
    await page.waitForTimeout(150)
    const at = await page.evaluate(() => {
      setHidden(true)
      return a.progress
    })
    await page.waitForTimeout(700)
    assert.equal(await page.evaluate(() => a.progress), at, 'no time passes while hidden')
    await page.evaluate(() => setHidden(false))
    await page.waitForTimeout(120)
    const after = await page.evaluate(() => a.progress)
    assert.ok(after > at && after < 1, `goes on from ${at}, now ${after}`)
    assert.equal(await page.evaluate(() => a.finished), true)
    await sameTransform(page, 'translate(200px, 0px) rotate(0deg) scale(1)')
  },

  async 'animate: a new target mid-flight starts from where it is, at the speed it had'(page) {
    await fixture(page)
    const r = await page.evaluate(async () => {
      const xs = []
      const x = () => new DOMMatrix(getComputedStyle(mover).transform).m41
      const first = animate(mover, { to: { x: 600 }, period: 600, onUpdate: (v) => xs.push(v.x) })
      await new Promise((r) => setTimeout(r, 120))
      const before = x()
      const turn = xs.length
      let live = false
      const next = animate(mover, { to: { x: 0 }, period: 600, onUpdate: (v) => live && xs.push(v.x) })
      next.pause()
      next.seek(0)
      const at0 = x()
      next.seek(16)
      const at16 = x()
      next.seek(0)
      live = true
      next.play()
      await next.finished
      return { before, at0, at16, xs, turn, first: await first.finished }
    })
    assert.ok(Math.abs(r.at0 - r.before) < 1, `no jump: ${r.before} then ${r.at0}`)
    assert.ok(r.at16 > r.at0, 'still moving the old way for a moment')
    assert.equal(r.first, false, 'the first one is taken over')
    // Frame by frame, the step at the hand-over is no bigger than the steps around it, plus 1 px.
    const steps = r.xs.slice(1).map((x, i) => Math.abs(x - r.xs[i]))
    const around = Math.max(...steps.slice(r.turn - 4, r.turn - 1), ...steps.slice(r.turn, r.turn + 3))
    assert.ok(steps[r.turn - 1] <= around + 1, `hand-over step ${steps[r.turn - 1]}, around ${around}`)
    assert.equal(r.xs.at(-1), 0)
  },

  async 'timeline: plays in order, reverses, and finished resolves'(page) {
    await fixture(page)
    const r = await page.evaluate(async () => {
      const order = []
      const tl = timeline({ onDone: () => order.push('end') })
        .add(mover, { to: { x: 100 }, duration: 80, onDone: () => order.push('x') })
        .label('moved')
        .add(mover, { to: { opacity: 0.2 }, duration: 80, onDone: () => order.push('fade') })
      const landed = await tl.finished
      const there = [mover.style.transform, mover.style.opacity]
      tl.reverse()
      await tl.finished
      return { order, landed, there, back: [mover.style.transform, mover.style.opacity], marks: tl.marks() }
    })
    const want = await page.evaluate(css, 'translate(100px, 0px) rotate(0deg) scale(1)')
    const zero = await page.evaluate(css, 'translate(0px, 0px) rotate(0deg) scale(1)')
    assert.deepEqual(r.order, ['x', 'fade', 'end', 'end'])
    assert.equal(r.landed, true)
    assert.deepEqual(r.there, [want, '0.2'])
    assert.deepEqual(r.back, [zero, '1'])
    assert.deepEqual(r.marks, [{ at: 80 }])
  },

  async 'docs: animate and timeline demos run, and the scrub settles on labels'(page) {
    await page.goto(`${base}/site/docs/animate.html`)
    await page.locator('#an-go').click()
    await settled(page, () => document.getElementById('an-out').textContent.includes('Landed'))
    await page.goto(`${base}/site/docs/timeline.html`)
    const scrub = page.locator('#tl-scrub')
    await scrub.focus()
    await page.keyboard.press('ArrowRight')
    await settled(page, () => document.getElementById('tl-scrub').getAttribute('aria-valuetext') === 'Packed')
    await page.keyboard.press('End')
    await settled(page, () => document.getElementById('tl-scrub').getAttribute('aria-valuetext') === 'Delivered')
    assert.equal(await page.locator('#tl-route li:last-child').getAttribute('data-on'), '')
  },

  async 'frame: every module shares one requestAnimationFrame'(page) {
    await fixture(page)
    const r = await page.evaluate(async () => {
      T.slider({ value: 0 })
      let asked = 0
      const real = window.requestAnimationFrame
      window.requestAnimationFrame = (fn) => (asked++, real(fn))
      const start = performance.now()
      let frames = 0
      const count = () => (frames++, performance.now() - start < 300 && real(count))
      real(count)
      s.go(100)
      animate(mover, { to: { x: 200 }, duration: 300 })
      timeline().add({ v: 0 }, { to: { v: 1 }, duration: 300 })
      await new Promise((r) => setTimeout(r, 300))
      window.requestAnimationFrame = real
      return { asked, frames }
    })
    assert.ok(r.asked <= r.frames + 2, `${r.asked} requests in ${r.frames} frames`)
  },

  async 'frame: long frames lower the budget, and motion still lands exactly'(page) {
    await fixture(page)
    const r = await page.evaluate(async () => {
      // A busy page: every frame takes about 45 ms of work.
      let busy = true
      const hog = () => {
        const end = performance.now() + 45
        while (performance.now() < end);
        if (busy) frame(hog)
      }
      frame(hog)
      await new Promise((r) => setTimeout(r, 900))
      const low = frameBudget.low
      const landed = await animate(mover, { to: { x: 120, opacity: 0.5 }, period: 300 }).finished
      busy = false
      const end = [new DOMMatrix(getComputedStyle(mover).transform).m41, getComputedStyle(mover).opacity]
      await new Promise((r) => {
        const spin = () => (frameBudget.low ? frame(spin) : r())
        frame(spin)
      })
      return { low, landed, end, after: frameBudget.low }
    })
    assert.equal(r.low, true, 'long frames make it low')
    assert.equal(r.landed, true)
    assert.deepEqual(r.end, [120, '0.5'], 'never a wrong end state')
    assert.equal(r.after, false, 'short frames bring it back')
  },

  async 'docs: the frame budget demo eases off when the page is busy'(page) {
    await page.goto(`${base}/site/docs/frame.html`)
    await page.locator('#fb-busy').click()
    await settled(page, () => document.getElementById('fb-out').textContent.includes('low'))
    await page.locator('#fb-busy').click()
    await settled(page, () => document.getElementById('fb-out').textContent.includes('keeping up'))
  },

  async 'scene: the scroll is the clock, both ways, and a fling never stops halfway'(page) {
    await fixture(page)
    const r = await page.evaluate(async () => {
      makeScene()
      const at = async (y) => {
        scrollTo(0, y)
        await nextFrame()
        return [Math.round(scene.progress * 1000) / 1000, Math.round(box.v)]
      }
      // The range runs from 1000 - 700 = 300 (top meets bottom) to 1600 (bottom meets top).
      return [await at(0), await at(950), await at(1600), await at(5000), await at(950), await at(0)]
    })
    assert.deepEqual(r, [[0, 0], [0.5, 150], [1, 300], [1, 300], [0.5, 150], [0, 0]])
  },

  async 'scene: it never takes the wheel and never scrolls the page'(page) {
    await fixture(page)
    await page.evaluate(() => makeScene())
    await page.mouse.move(200, 200)
    const prevented = await page.evaluate(() => {
      const e = new WheelEvent('wheel', { deltaY: 100, cancelable: true, bubbles: true })
      document.body.dispatchEvent(e)
      return e.defaultPrevented
    })
    assert.equal(prevented, false)
    await page.mouse.wheel(0, 700)
    await settled(page, () => scrollY > 600)
    await page.waitForTimeout(400)
    const y = await page.evaluate(() => scrollY)
    await page.waitForTimeout(400)
    assert.equal(await page.evaluate(() => scrollY), y, 'the page stays where the hand left it')
    assert.ok(await page.evaluate(() => scene.progress > 0 && scene.progress < 1))
  },

  async 'scene: reduced motion jumps to the end as it comes in, and back once gone above'(page) {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await fixture(page)
    const r = await page.evaluate(async () => {
      makeScene()
      const at = async (y) => (scrollTo(0, y), await nextFrame(), box.v)
      return [await at(0), await at(320), await at(950), await at(0)]
    })
    assert.deepEqual(r, [0, 300, 300, 0])
  },

  async 'scene: with detentScroll it settles onto a label'(page) {
    await fixture(page)
    await page.evaluate(() => {
      makeScene()
      window.settle = detentScroll({ marks: scene.marks })
    })
    assert.deepEqual(await page.evaluate(() => scene.marks()), [733, 1600])
    await page.mouse.move(200, 200)
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 110)
    await settled(page, () => Math.round(scrollY) === 733)
    const y = await page.evaluate(() => Math.round(scrollY))
    assert.equal(y, 733, 'it lands on the label nearest the stop')
    assert.equal(await page.evaluate(() => Math.round(box.v)), 100)
    await page.evaluate(() => (settle.destroy(), scene.destroy()))
  },

  async 'docs: the scene demo runs'(page) {
    await page.goto(`${base}/site/docs/scene.html`)
    await page.evaluate(() => document.getElementById('sc-stage').scrollIntoView())
    await settled(page, () => !document.getElementById('sc-out').textContent.startsWith('0%'))
  },

  async 'morph: it plays from the old place to the new one with no jump, and lays out once'(page) {
    await fixture(page)
    const r = await page.evaluate(async () => {
      const before = rect()
      const m = morph(mover, () => Object.assign(mover.style, { left: '300px', width: '120px' }))
      const start = rect()
      await nextFrame()
      const mid = rect()
      const layout = [mover.offsetLeft, mover.offsetWidth]
      const landed = await m.finished
      return { before, start, mid, layout, end: rect(), landed, transform: mover.style.transform }
    })
    assert.deepEqual(r.start, r.before, 'drawn at its old place first')
    assert.ok(r.mid[0] > 0 && r.mid[0] < 300, `moving, at ${r.mid[0]}`)
    assert.deepEqual(r.layout, [300, 120], 'the layout is the new one the whole way')
    assert.deepEqual(r.end, [300, 400, 120, 40])
    assert.equal(r.landed, true)
    assert.equal(r.transform, '')
  },

  async 'morph: a new change mid-flight starts from where it is, at its speed'(page) {
    await fixture(page)
    const r = await page.evaluate(async () => {
      morph(mover, () => (mover.style.left = '400px'), { period: 600 })
      await new Promise((r) => setTimeout(r, 120))
      const before = rect()
      const next = morph(mover, () => (mover.style.left = '0px'), { period: 600 })
      const after = rect()
      await nextFrame()
      const soon = rect()
      await next.finished
      return { before, after, soon, end: rect() }
    })
    assert.ok(Math.abs(r.after[0] - r.before[0]) < 1, `no jump: ${r.before[0]} then ${r.after[0]}`)
    assert.ok(r.soon[0] >= r.after[0] - 0.5, 'still going the old way for a moment')
    assert.equal(r.end[0], 0)
  },

  async 'morph: a shared element grows out of another one'(page) {
    await fixture(page)
    const r = await page.evaluate(async () => {
      const from = rect(thumb)
      const m = morph(mover, () => (mover.style.width = '200px'), { from: thumb })
      const start = rect()
      await m.finished
      return { from, start, end: rect() }
    })
    assert.deepEqual(r.start, r.from)
    assert.deepEqual(r.end, [0, 400, 200, 40])
  },

  async 'morph: reduced motion shows the change at once'(page) {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await fixture(page)
    const r = await page.evaluate(() => {
      let done = false
      morph(mover, () => (mover.style.left = '250px'), { onDone: () => (done = true) })
      return [rect()[0], mover.style.transform, done]
    })
    assert.deepEqual(r, [250, '', true])
  },
}

let pass = 0
let fail = 0
for (const name of names) {
  const browser = await pw[name].launch()
  for (const [title, run] of Object.entries(tests)) {
    if (process.env.ONLY && !title.includes(process.env.ONLY)) continue
    const context = await browser.newContext({ viewport: { width: 900, height: 700 }, hasTouch: title.startsWith('touch:') })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    try {
      await run(page, name)
      assert.deepEqual(errors, [], 'no page errors')
      pass++
      console.log(`ok   ${name}: ${title}`)
    } catch (e) {
      fail++
      console.log(`FAIL ${name}: ${title}\n     ${e.message.split('\n').slice(0, 4).join('\n     ')}`)
    }
    await context.close()
  }
  await browser.close()
}
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
