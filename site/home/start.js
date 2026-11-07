import { detent } from '@hlmnhkl/detent'

const knob = document.querySelector('.knob')

// Finger, mouse, keys and screen reader: done. You draw it.
detent(knob, {
  value: 50,
  min: 0,
  max: 100,
  step: 25,
  size: 2,
  onInput: (v) => (knob.style.rotate = `${v * 2.7 - 135}deg`),
})
