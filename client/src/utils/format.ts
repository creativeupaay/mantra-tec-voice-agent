/**
 * Formats a duration in seconds into a human-readable string (e.g., "2m 5s").
 */
export const formatDuration = (secs: number | undefined | null): string => {
  if (secs === undefined || secs === null) return 'In progress'
  const total = Math.max(0, Math.floor(secs))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

/**
 * Safely parses any timestamp (ISO string, date string, unix timestamp, Mongo ObjectId) into a JS Date.
 */
export const parseToDate = (timestamp: any): Date | null => {
  if (!timestamp) return null
  if (timestamp instanceof Date) return isNaN(timestamp.getTime()) ? null : timestamp

  if (typeof timestamp === 'number') {
    const ms = timestamp < 1e11 ? timestamp * 1000 : timestamp
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d
  }

  if (typeof timestamp === 'string') {
    let str = timestamp.trim()
    if (!str) return null

    if (/^\d+$/.test(str)) {
      const num = parseInt(str, 10)
      const ms = num < 1e11 ? num * 1000 : num
      const d = new Date(ms)
      if (!isNaN(d.getTime())) return d
    }

    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(str)) {
      str = str.replace(' ', 'T')
    }

    if (str.includes('T') && !str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
      str += 'Z'
    }

    const d = new Date(str)
    if (!isNaN(d.getTime())) return d

    if (/^[a-f\d]{24}$/i.test(str)) {
      const seconds = parseInt(str.slice(0, 8), 16)
      const dObj = new Date(seconds * 1000)
      if (!isNaN(dObj.getTime())) return dObj
    }
  }

  return null
}

/**
 * Parses any date/timestamp input and returns formatted date and time in Indian Standard Time (IST, Asia/Kolkata).
 */
export const formatTime = (iso: any): { date: string; time: string; full: string } => {
  const d = parseToDate(iso)
  if (!d) return { date: '-', time: '-', full: '-' }

  const dateStr = d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })

  const timeStr = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })

  return {
    date: dateStr,
    time: `${timeStr} IST`,
    full: `${dateStr}, ${timeStr} IST`,
  }
}
