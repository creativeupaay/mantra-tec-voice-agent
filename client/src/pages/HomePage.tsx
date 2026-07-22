import { FC } from 'react'
import StatusDot from '../components/StatusDot'
import { AudioWaveform } from 'lucide-react'

// Helper to generate a simple SVG sparkline from data points
const Sparkline = ({ data }: { data: number[] }) => {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * 70
      const y = 18 - ((val - min) / range) * 18
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width="70" height="18" className="overflow-visible">
      <polyline
        fill="none"
        stroke="var(--color-text-muted)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

const HomePage: FC = () => {
  const stats = [
    { label: 'Active Agents', value: '12', trendData: [8, 9, 10, 11, 10, 12, 12], isLive: true },
    { label: 'Total Sessions', value: '1,248', trendData: [1000, 1050, 1100, 1150, 1200, 1220, 1248] },
    { label: 'Avg Response Time', value: '1.2s', trendData: [1.6, 1.5, 1.4, 1.3, 1.25, 1.22, 1.2] },
    { label: 'Success Rate', value: '98.5%', trendData: [95, 96, 97, 97.5, 98, 98.2, 98.5] },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-text-primary">Dashboard</h2>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-surface-card rounded-2xl border border-border p-6">
            <div className="flex items-center space-x-2 mb-2">
              {stat.isLive && (
                <div className="w-1.5 h-1.5 rounded-full bg-(--color-accent) animate-live-pulse" />
              )}
              <p className="text-[13px] font-medium text-text-secondary">{stat.label}</p>
            </div>
            {/* V2.1: Mono font for numerals only */}
            <p className="text-3xl font-semibold text-text-primary font-mono tabular-nums mb-2">{stat.value}</p>
            {/* V2.1: Sparkline instead of text */}
            <Sparkline data={stat.trendData} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-surface-card rounded-2xl border border-border p-6">
          <h3 className="text-[15px] font-semibold text-text-primary mb-4">Recent Activity</h3>
          <div className="space-y-0">
            {[
              { id: 1, label: 'Agent session completed', sub: 'Voice agent #001 • 2 min ago', status: 'live' as const },
              { id: 2, label: 'Call escalated to human', sub: 'Voice agent #002 • 15 min ago', status: 'escalated' as const },
              { id: 3, label: 'Customer callback missed', sub: 'Voice agent #003 • 1 hr ago', status: 'missed' as const },
              { id: 4, label: 'Session resolved', sub: 'Voice agent #004 • 2 hrs ago', status: 'resolved' as const },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between py-4 border-b border-border last:border-0 last:pb-0">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-surface-page border border-border flex items-center justify-center text-text-secondary">
                    <AudioWaveform size={16} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{item.label}</p>
                    <p className="text-[12px] text-text-secondary">{item.sub}</p>
                  </div>
                </div>
                <StatusDot status={item.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-surface-card rounded-2xl border border-border p-6">
          <h3 className="text-[15px] font-semibold text-text-primary mb-4">Quick Actions</h3>
          <div className="flex flex-col space-y-3">
            <button className="w-full px-4 py-2.5 bg-text-primary text-surface-card rounded-lg hover:bg-black text-[13px] font-medium transition-colors">
              Create New Agent
            </button>
            <button className="w-full px-4 py-2.5 bg-transparent border border-border text-text-primary rounded-lg hover:bg-surface-page text-[13px] font-medium transition-colors">
              View Reports
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage