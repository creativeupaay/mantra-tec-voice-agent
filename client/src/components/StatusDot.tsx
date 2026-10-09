import { FC } from 'react'
import { CallStatus } from '../types/call'

interface StatusDotProps {
  status: CallStatus
  label?: string
}

const StatusDot: FC<StatusDotProps> = ({ status, label }) => {
  const safeStatus = (status || 'resolved').toLowerCase() as CallStatus
  const displayLabel =
    label ||
    (safeStatus === 'callback_required'
      ? 'Callback Required'
      : typeof safeStatus === 'string'
      ? safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1)
      : 'Resolved')

  const getPillStyles = (): { bg: string; dot: string } => {
    switch (safeStatus) {
      case 'resolved':
        return {
          bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
          dot: 'bg-emerald-500',
        }
      case 'callback_required':
        return {
          bg: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
          dot: 'bg-indigo-500',
        }
      case 'escalated':
        return {
          bg: 'bg-red-500/10 text-red-600 border-red-500/20',
          dot: 'bg-red-500',
        }
      case 'missed':
        return {
          bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
          dot: 'bg-amber-500',
        }
      case 'live':
        return {
          bg: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
          dot: 'bg-blue-500 animate-pulse',
        }
      default:
        return {
          bg: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
          dot: 'bg-slate-400',
        }
    }
  }

  const styles = getPillStyles()

  return (
    <span className={`inline-flex items-center justify-center gap-1.5 w-[96px] py-1 px-2.5 rounded-full text-[11px] font-semibold tracking-wide border shadow-2xs ${styles.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />
      <span className="capitalize truncate">{displayLabel}</span>
    </span>
  )
}

export default StatusDot
