export type ShareTargets = {
  facebook: string
  bluesky: string
  whatsapp: string
}

export function shareTargets(url: string, text: string): ShareTargets {
  const message = `${text} ${url}`
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(message)}`,
    bluesky: `https://bsky.app/intent/compose?text=${encodeURIComponent(message)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
  }
}
