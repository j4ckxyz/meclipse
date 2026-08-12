import { useEffect, useState } from 'react'

const SESSION_KEY = 'meclipse:visitor-session:v1'
const COUNT_KEY = 'meclipse:visitor-count:v1'
const COUNT_CACHE_MS = 5 * 60_000

type CachedCount = { value: number; at: number }

function storedCount(): number | null {
  try {
    const cached = JSON.parse(sessionStorage.getItem(COUNT_KEY) || 'null') as CachedCount | null
    return cached && Number.isFinite(cached.value) && Date.now() - cached.at < COUNT_CACHE_MS ? cached.value : null
  } catch {
    return null
  }
}

function visitorSession(): string {
  try {
    const current = sessionStorage.getItem(SESSION_KEY)
    if (current) return current
    const created = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

function VisitorCount({ className = '' }: { className?: string }) {
  const [count, setCount] = useState<number | null>(storedCount)

  useEffect(() => {
    if (count !== null) return
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch('/api/visitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: visitorSession() }),
          signal: controller.signal,
        })
        if (!response.ok) return
        const payload = await response.json() as { available?: boolean; count?: number }
        if (!payload.available || !Number.isFinite(payload.count)) return
        const nextCount = Math.max(0, Math.floor(payload.count!))
        setCount(nextCount)
        try {
          sessionStorage.setItem(COUNT_KEY, JSON.stringify({ value: nextCount, at: Date.now() }))
        } catch {
          // A private browser may deny storage; the counter can still render for this page.
        }
      } catch {
        // The visitor count is deliberately non-essential and must never block the app.
      }
    }

    const idleWindow = window as Window & typeof globalThis & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }
    const handle = idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(load, { timeout: 2_000 })
      : window.setTimeout(load, 1_200)
    return () => {
      controller.abort()
      if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(handle)
      else window.clearTimeout(handle)
    }
  }, [count])

  if (count === null) return null
  const people = new Intl.NumberFormat('en-GB').format(count)
  return (
    <span className={`visitor-count ${className}`.trim()} title="Approximate browser sessions; refreshing does not count twice.">
      <span aria-hidden="true" className="visitor-pulse" />
      {people} {count === 1 ? 'person has' : 'people have'} checked the sky
    </span>
  )
}

export default VisitorCount
