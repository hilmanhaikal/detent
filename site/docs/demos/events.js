const panel = document.querySelector('#demo-tabs')
const log = document.querySelector('#demo-log')

// Both events bubble, so one listener hears every control inside.
panel.addEventListener('detent:change', (e) => {
  const line = document.createElement('li')
  line.textContent = `detent:change on ${e.target.getAttribute('aria-label')}: ${e.detail.value}`
  log.prepend(line)
  log.querySelectorAll('li:nth-child(n + 5)').forEach((old) => old.remove())
})
