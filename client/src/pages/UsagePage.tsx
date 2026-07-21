import { FC, useEffect, useState, useMemo } from 'react'
import { analyticsApi, ICreditUsage } from '../api/client'
import { DollarSign, Activity, Zap } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

// Tonal palette derived from the design system — accent blue + stepped neutrals
const SERVICE_COLORS: Record<string, string> = {
  plivo:      '#2451DA',  // accent (primary)
  openrouter: '#3B6BE8',  // accent-mid
  gemini:     '#6B8FEF',  // accent-light
  deepgram:   '#18181B',  // text-primary (near-black)
  cartesia:   '#71717A',  // text-secondary
  elevenlabs: '#A1A1AA',  // text-muted
  platform:   '#D4D4D8',  // border-strong
}

const UsagePage: FC = () => {
  const [creditUsage, setCreditUsage] = useState<ICreditUsage[]>([])
  const [creditBalance, setCreditBalance] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      analyticsApi.getAllCreditUsage(),
      analyticsApi.getCreditBalance()
    ])
      .then(([usageRes, balanceRes]) => {
        setCreditUsage(usageRes.data.data)
        setCreditBalance(balanceRes.data.data.creditBalance)
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false))
  }, [])

  // ── DATA AGGREGATION FOR CHARTS ──
  
  // 1. Calculate Total Spent this month
  const totalSpent = useMemo(() => {
    return creditUsage
      .filter(u => u.type === 'usage')
      .reduce((sum, curr) => sum + curr.amount, 0)
  }, [creditUsage])

  // 2. Prepare data for Pie Chart (Cost by Service)
  const costByService = useMemo(() => {
    const breakdown: Record<string, number> = {}
    creditUsage.forEach(usage => {
      if (usage.type === 'usage' && usage.service) {
        breakdown[usage.service] = (breakdown[usage.service] || 0) + usage.amount
      }
    })
    
    // Convert to array format expected by Recharts: [{ name: 'plivo', value: 12.50 }, ...]
    return Object.entries(breakdown)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(3)) }))
      .sort((a, b) => b.value - a.value) // Sort largest first
  }, [creditUsage])

  // 3. Prepare data for Bar Chart (Daily Spend)
  const dailySpend = useMemo(() => {
    const days: Record<string, number> = {}
    
    // Initialize last 7 days with 0
    for(let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0
    }

    // Accumulate costs
    creditUsage.forEach(usage => {
      if (usage.type === 'usage') {
        const dateStr = new Date(usage.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        if (days[dateStr] !== undefined) {
          days[dateStr] += usage.amount
        }
      }
    })

    return Object.entries(days).map(([date, amount]) => ({
      date,
      amount: Number(amount.toFixed(2))
    }))
  }, [creditUsage])


  return (
    <div className="space-y-6 pb-10">
      
      {/* ── HEADER ── */}
      <div>
        <h2 className="text-2xl font-semibold text-text-primary tracking-tight">Credit Usage</h2>
        <p className="text-[14px] text-text-secondary mt-1">Monitor your AI API costs and platform usage in real-time.</p>
      </div>

      {/* ── TOP METRICS CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-accent-bg flex items-center justify-center text-accent">
              <DollarSign size={17} />
            </div>
            <h3 className="text-[13px] font-medium text-text-secondary uppercase tracking-wider">Available Balance</h3>
          </div>
          <p className="text-3xl font-semibold text-text-primary tabular-nums">${creditBalance.toFixed(2)}</p>
        </div>

        <div className="bg-surface-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-surface-page border border-border flex items-center justify-center text-text-secondary">
              <Activity size={17} />
            </div>
            <h3 className="text-[13px] font-medium text-text-secondary uppercase tracking-wider">Total Spend (30d)</h3>
          </div>
          <p className="text-3xl font-semibold text-text-primary tabular-nums">${totalSpent.toFixed(2)}</p>
        </div>

        <div className="bg-surface-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-surface-page border border-border flex items-center justify-center text-text-secondary">
              <Zap size={17} />
            </div>
            <h3 className="text-[13px] font-medium text-text-secondary uppercase tracking-wider">Top Cost Driver</h3>
          </div>
          <p className="text-3xl font-semibold text-text-primary capitalize">
            {costByService.length > 0 ? costByService[0].name : 'N/A'}
          </p>
        </div>
      </div>

      {/* ── CHARTS SECTION (YOUR TASK) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Cost Breakdown Donut Chart */}
        <div className="bg-surface-card p-6 rounded-2xl border border-border shadow-sm lg:col-span-1 min-h-87.5 flex flex-col">
          <h3 className="text-[15px] font-semibold text-text-primary mb-6">Cost by Service</h3>
          
          <div className="flex-1 w-full min-h-62.5">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={costByService}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {costByService.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SERVICE_COLORS[entry.name] || SERVICE_COLORS.platform} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Cost']}
                  contentStyle={{ backgroundColor: 'var(--color-surface-card)', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)', color: 'var(--color-text-primary)' }}
                  itemStyle={{ color: 'var(--color-text-primary)' }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="mt-4 w-full space-y-2">
              {costByService.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: SERVICE_COLORS[entry.name] || SERVICE_COLORS.platform }} />
                    <span className="text-[12px] text-text-secondary capitalize">{entry.name}</span>
                  </div>
                  <span className="text-[12px] font-medium text-text-primary tabular-nums">${entry.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Daily Spend Bar Chart */}
        <div className="bg-surface-card p-6 rounded-2xl border border-border shadow-sm lg:col-span-2 min-h-87.5 flex flex-col">
          <h3 className="text-[15px] font-semibold text-text-primary mb-6">Spend Over Time (Last 7 Days)</h3>
          
          <div className="flex-1 w-full min-h-62.5 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySpend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  cursor={{ fill: 'var(--color-surface-page)', radius: 4 }}
                  contentStyle={{ backgroundColor: 'var(--color-surface-card)', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)', color: 'var(--color-text-primary)' }}
                  itemStyle={{ color: 'var(--color-text-primary)' }}
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Spend']}
                />
                <Bar dataKey="amount" fill="var(--color-accent)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
      </div>

      {/* ── LOGS TABLE ── */}
      <div className="bg-surface-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-border">
          <h3 className="text-[15px] font-semibold text-text-primary">Detailed Usage Logs</h3>
        </div>
        
        {isLoading ? (
          <div className="p-12 text-center text-text-secondary text-sm">Loading logs...</div>
        ) : creditUsage.length === 0 ? (
          <div className="p-12 text-center text-text-secondary text-sm">No credit usage records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-page/30">
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border">Date</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border">Service</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border">Description</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border">Metrics</th>
                  <th className="px-6 py-4 text-right text-[12px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {creditUsage.map((usage) => (
                  <tr key={usage._id} className="hover:bg-surface-page transition-colors">
                    <td className="px-6 py-4 text-[13px] text-text-secondary whitespace-nowrap">
                      {new Date(usage.createdAt).toLocaleString('en-US', { 
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {usage.service ? (
                         <div className="flex items-center space-x-2">
                           <div 
                             className="w-2 h-2 rounded-full shrink-0" 
                             style={{ backgroundColor: SERVICE_COLORS[usage.service] || SERVICE_COLORS.platform }}
                           />
                           <span className="text-[13px] font-medium text-text-primary capitalize">{usage.service}</span>
                         </div>
                      ) : (
                        <span className="text-[13px] text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-[13px] text-text-secondary">
                      {usage.description}
                    </td>
                    <td className="px-6 py-4">
                      {usage.metadata && Object.keys(usage.metadata).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {usage.metadata.duration_seconds && (
                            <span className="px-2 py-0.5 rounded bg-surface-page text-[11px] text-text-secondary border border-border">
                              {usage.metadata.duration_seconds}s
                            </span>
                          )}
                          {usage.metadata.tokens_prompt && (
                            <span className="px-2 py-0.5 rounded bg-surface-page text-[11px] text-text-secondary border border-border">
                              {usage.metadata.tokens_prompt} prompt tkns
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[13px] text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                       <span className={`text-[13px] font-medium tabular-nums ${usage.type === 'usage' ? 'text-text-primary' : 'text-emerald-600'}`}>
                         {usage.type === 'usage' ? '-' : '+'}${usage.amount.toFixed(3)}
                       </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
    </div>
  )
}

export default UsagePage