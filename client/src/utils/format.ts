/**
 * Formats a duration in seconds into a human-readable string (e.g., "2m 5s").
 */
export const formatDuration = (secs: number | undefined): string => {
  if (secs === undefined) return 'In progress'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

/**
 * Parses an ISO date string and returns formatted date and time parts.
 */
export const formatTime = (iso: string): { date: string; time: string } => {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
  }
}
