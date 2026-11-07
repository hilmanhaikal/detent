import { detent } from '@hlmnhkl/detent'

const box = document.querySelector('#r-price')
const [low, high] = box.querySelectorAll('[role="slider"]')
const out = box.querySelector('output')
const rm = (v) => `RM ${v}`
const marks = [{ at: 100, strong: true }, { at: 250, strong: true }, { at: 500, strong: true }]
const show = () => (out.textContent = `${rm(lo.value)} to ${rm(hi.value)}`)

// Two thumbs on one track. Each one's end is the other one's value, so they never cross.
const lo = detent(low, { min: 0, max: 450, step: 10, value: 100, marks, text: rm, onInput: (v) => box.style.setProperty('--lo', v), onChange: (v) => (hi.set({ min: v + 50 }), show()) })
const hi = detent(high, { min: 150, max: 1000, step: 10, value: 500, marks, text: rm, onInput: (v) => box.style.setProperty('--hi', v), onChange: (v) => (lo.set({ max: v - 50 }), show()) })
show()
