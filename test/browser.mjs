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
}

let pass = 0
let fail = 0
for (const name of names) {
  const browser = await pw[name].launch()
  for (const [title, run] of Object.entries(tests)) {
    if (process.env.ONLY && !title.includes(process.env.ONLY)) continue
    const context = await browser.newContext({ viewport: { width: 900, height: 700 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    try {
      await run(page)
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
