import { detent } from '@hlmnhkl/detent'

// The element has aria-label="Delivery tip". detent adds the role, tabindex and values.
detent(document.querySelector('#named'), {
  min: 0,
  max: 20,
  step: 1,
  value: 5,
  marks: [{ at: 10, strong: true }],
  cssVar: '--value',
  text: (v) => `RM ${v}`,
})
