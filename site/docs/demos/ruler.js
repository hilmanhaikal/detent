import { detent } from '@hlmnhkl/detent'

const ruler = document.querySelector('#demo-ruler')
const out = document.querySelector('#demo-ruler-out')
ruler.querySelector('.d-track').innerHTML = Array.from({ length: 201 }, (_, i) => `<i style="--i:${i}"${i % 10 ? '' : ` class="big" data-n="${i}"`}></i>`).join('')

// The track moves under a fixed pin, so a drag to the right lowers the value: invert.
// Every 10 cm is strong. Each centimetre is 12px.
detent(ruler, {
  min: 0,
  max: 200,
  value: 120,
  marks: Array.from({ length: 21 }, (_, i) => ({ at: i * 10, strong: true })),
  invert: true,
  size: 12,
  coast: 0.3,
  cssVar: '--v',
  text: (v) => `${v} centimetres`,
  onChange: (v) => (out.textContent = `${v} cm`),
})
