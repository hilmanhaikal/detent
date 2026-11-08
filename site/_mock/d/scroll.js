import { detentScroll } from '@hlmnhkl/detent'

// The page settles on its parts with a mouse wheel or trackpad. Touch keeps the phone's own scroll, as people expect.
const parts = [...document.querySelectorAll('[data-mark]')]
// show
if (matchMedia('(pointer: fine)').matches) {
  detentScroll({
    marks: parts,
    onChange: (i) => parts.forEach((p, k) => p.toggleAttribute('data-resting', k === i)),
  })
}
// end
