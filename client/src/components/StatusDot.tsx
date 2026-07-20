import { FC } from 'react'
import { CallStatus } from '../types/call'

interface StatusDotProps {
  status: CallStatus
  label?: string
}

const StatusDot: FC<StatusDotProps> = ({ status, label }) => {
  const getDotStyle = (): React.CSSProperties => {
    switch (status) {
      case 'resolved':
        return { backgroundColor: 'var(--color-status-resolved)' }
      case 'escalated':
        return { backgroundColor: 'var(--color-status-escalated)' }
      case 'missed':
        return { backgroundColor: 'var(--color-status-missed)' }
      case 'live':
        return { backgroundColor: 'var(--color-status-live)' }
      default:
        return { backgroundColor: 'var(--color-text-muted)' }
    }
  }

  const defaultLabel = status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <div className="flex items-center space-x-2">
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${status === 'live' ? 'animate-live-pulse' : ''}`}
        style={getDotStyle()}
      />
      <span className="text-[13px] font-medium text-text-secondary">
        {label || defaultLabel}
      </span>
    </div>
  )
}

export default StatusDot
