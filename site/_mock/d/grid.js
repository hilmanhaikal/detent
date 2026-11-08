// Puts the page on the sheet's 10 px grid: each drawing gets a scale that makes its key lengths
// whole squares and its main centre a grid crossing; chips and parts round up to whole tens.
const G = 10
const wide = matchMedia('(min-width: 861px)')

// centre: the main shaft. sizes: lengths that must be whole squares, tried in order until one fits.
const drawings = [
  { sel: '.geneva', centre: [0, 0], sizes: [[100]], box: () => (wide.matches ? [560, 0.38] : [1, 0.26]) },
  { sel: '.m-ball', centre: [0, 0], sizes: [[140]] },
  { sel: '.m-glide', centre: [0, 0], sizes: [[130, 70], [130]] },
  { sel: '.m-toggle', centre: [0, 30], sizes: [[110]] },
  { sel: '.m-index', centre: [0, 0], sizes: [[128]] },
  { sel: '.m-cam', centre: [0, 0], sizes: [[104]], box: () => (wide.matches ? [1, 0.4] : [1, 0.18]) },
]
const gcd = (a, b) => (b ? gcd(b, a % b) : a)

// The width the drawing may take: its rig, or its own grid column when it sits in one.
function room(svg) {
  const holder = svg.parentElement
  if (holder.classList.contains('rig')) return holder.clientWidth
  const cols = getComputedStyle(holder).gridTemplateColumns.split(' ').map(parseFloat)
  return wide.matches ? cols[cols.length - 1] : cols[0]
}

function fitDrawing({ sel, centre, sizes, box }) {
  const svg = document.querySelector(sel)
  svg.dataset.vb ||= svg.getAttribute('viewBox')
  const [vx, vy, vw, vh] = svg.dataset.vb.split(' ').map(Number)
  const col = room(svg)
  const [w, h] = box?.() ?? (wide.matches ? [1, 0.62] : [0.82, 0.4])
  let maxW = w > 1 ? Math.min(w, col) : col * w
  let maxH = wide.matches ? Math.min(innerHeight * h, 540) : Math.min(innerHeight * h, innerHeight - 400)
  // In the machine each drawing fills its own cell, less one square so the rounding never spills out.
  if (svg.closest('.machine-sheet')) {
    maxW = svg.parentElement.clientWidth - G
    maxH = svg.parentElement.clientHeight - G
  }
  const most = Math.min(maxW / vw, maxH / vh)
  let s = 0
  let whole = null
  for (const list of sizes) {
    const unit = G / list.reduce(gcd)
    s = Math.floor(most / unit) * unit
    whole = list
    if (s > 0) break
  }
  const cx = Math.round(((centre[0] - vx) * s) / G) * G
  const cy = Math.round(((centre[1] - vy) * s) / G) * G
  const W = Math.ceil((vw * s) / G) * G
  const H = Math.ceil((vh * s) / G) * G
  svg.setAttribute('viewBox', `${centre[0] - cx / s} ${centre[1] - cy / s} ${W / s} ${H / s}`)
  svg.style.width = `${W}px`
  svg.style.height = `${H}px`
  svg.dataset.scale = s
  svg.dataset.whole = whole.join(' ')
}

export function fit() {
  for (const d of drawings) fitDrawing(d)
  for (const el of document.querySelectorAll('.chip')) {
    el.style.width = ''
    el.style.width = `${Math.ceil(el.offsetWidth / G) * G}px`
  }
  for (const part of document.querySelectorAll('main > section')) {
    part.style.minHeight = ''
    part.style.minHeight = `${Math.ceil(part.offsetHeight / G) * G}px`
  }
  dispatchEvent(new Event('sheetfit'))
}

let raf = 0
const later = () => {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(fit)
}
addEventListener('resize', later)
document.fonts?.ready.then(later)
