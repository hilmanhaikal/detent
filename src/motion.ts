/** 'auto' follows the reader's reduced motion setting, live. 'reduce' always lands at once. */
export type Motion = 'auto' | 'reduce' | 'full'

let query: MediaQueryList | undefined

export function reduced(motion: Motion = 'auto') {
  if (motion !== 'auto') return motion === 'reduce'
  if (typeof matchMedia !== 'function') return false
  query ??= matchMedia('(prefers-reduced-motion: reduce)')
  return query.matches
}
