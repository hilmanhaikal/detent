/** Writes attributes on `el` and puts back what was there before when `restore` runs. */
export function attrs(el: HTMLElement) {
  const before = new Map<string, string | null>()
  const keep = (name: string) => {
    if (!before.has(name)) before.set(name, el.getAttribute(name))
  }
  return {
    set(name: string, value: string | null) {
      keep(name)
      if (value === null) el.removeAttribute(name)
      else el.setAttribute(name, value)
    },
    /** Only when the developer has not set it. */
    fill(name: string, value: string) {
      if (!el.hasAttribute(name)) this.set(name, value)
    },
    restore() {
      before.forEach((v, name) => (v === null ? el.removeAttribute(name) : el.setAttribute(name, v)))
      before.clear()
    },
  }
}

const warned = new WeakSet<Element>()

export function needsName(el: HTMLElement) {
  if (warned.has(el) || el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') || el.hasAttribute('title')) return
  warned.add(el)
  console.warn('detent: give this element a name with aria-label or aria-labelledby, so screen readers can say what it is.', el)
}

let region: HTMLElement | null = null
let users = 0

/** One polite live region for the whole page, shared by every detent that speaks. */
export function voice() {
  users++
  let timer = 0
  let gone = false
  // Made up front: screen readers often miss words put into a live region that has only just appeared.
  if (!region) {
    region = document.createElement('div')
    region.setAttribute('aria-live', 'polite')
    region.setAttribute('data-detent-voice', '')
    region.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap'
    document.body.append(region)
  }
  return {
    say(text: string) {
      if (!region) return
      // Cleared first, so the same words said twice are read twice.
      region.textContent = ''
      clearTimeout(timer)
      timer = window.setTimeout(() => region && (region.textContent = text), 50)
    },
    off() {
      clearTimeout(timer)
      if (gone) return
      gone = true
      if (--users > 0) return
      region?.remove()
      region = null
    },
  }
}
