export const formatDate = (date: Date, timeZone?: string, locale?: string | string[]) =>
  new Intl.DateTimeFormat(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone,
  }).format(date)

export const formatTime = (date: Date, timeZone?: string, locale?: string | string[]) =>
  new Intl.DateTimeFormat(locale, {
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone,
  }).format(date)

export const formatShortTime = (date: Date, timeZone?: string, locale?: string | string[]) =>
  new Intl.DateTimeFormat(locale, {
    hour: '2-digit', minute: '2-digit', timeZone,
  }).format(date)

export const formatTimeZone = (date: Date, timeZone: string, locale?: string | string[]) => {
  const formatter = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'long' })
  return formatter.formatToParts(date).find(({ type }) => type === 'timeZoneName')?.value ?? timeZone
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours ? `${hours} hr ${remainder} min` : `${remainder} min`
}

export function formatCentralDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes} min ${String(seconds % 60).padStart(2, '0')} sec`
}
