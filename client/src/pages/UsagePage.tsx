import { FC, useEffect, useState, useMemo } from 'react'
import { analyticsApi, ICreditUsage } from '../api/client'
import { DollarSign, Activity, Zap } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'

// Tonal palette derived from the design system — accent blue + stepped neutrals
const SERVICE_COLORS: Record<string, string> = {
  plivo:      '#2451DA',
  openrouter: '#3B6BE8',
  gemini:     '#6B8FEF',
  deepgram:   '#18181B',
  cartesia:   '#71717A',
  elevenlabs: '#A1A1AA',
  platform:   '#D4D4D8',
}

const usd = (n: number, digits = 4) =>
  `$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`

const MetricChip: FC<{ label: string }> = ({ label }) => (
  <span className="px-2 py-0.5 rounded bg-surface-page text-[11px] text-text-secondary border border-border whitespace-nowrap">
    {label}
  </span>
)

const formatMetrics = (usage: ICreditUsage): string[] => {
  const m = usage.metadata || {}
  const chips: string[] = []

  const prompt = m.prompt_tokens ?? m.tokens_prompt
  const completion = m.completion_tokens ?? m.tokens_completion
  const total = m.total_tokens ?? (
    typeof prompt === 'number' && typeof completion === 'number'
      ? prompt + completion
      : undefined
  )

  if (typeof total === 'number' && total > 0) {
    if (typeof prompt === 'number' && typeof completion === 'number') {
      chips.push(`${total.toLocaleString()} tkns (${prompt.toLocaleString()} in / ${completion.toLocaleString()} out)`)
    } else {
      chips.push(`${total.toLocaleString()} tokens`)
    }
  }

  if (typeof m.characters === 'number' && m.characters > 0) {
    chips.push(`${m.characters.toLocaleString()} chars`)
  }

  if (typeof m.duration_seconds === 'number' && m.duration_seconds > 0) {
    chips.push(`${m.duration_seconds}s`)
  }

  if (m.api) {
    chips.push(String(m.api).replace(/_/g, ' '))
  }

  if (m.calculation) {
    chips.push(String(m.calculation))
  }

  return chips
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
        const usageData = usageRes.data?.data
        const usagesArray = Array.isArray(usageData)
          ? usageData
          : Array.isArray((usageData as any)?.usages)
            ? (usageData as any).usages
            : []
        setCreditUsage(usagesArray)

        const balanceData = balanceRes.data?.data
        const balanceVal = typeof balanceData === 'number'
          ? balanceData
          : ((balanceData as any)?.credit_balance ?? (balanceData as any)?.creditBalance ?? 0)
        setCreditBalance(balanceVal)
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false))
  }, [])

  const totalSpent = useMemo(() => {
    const list = Array.isArray(creditUsage) ? creditUsage : []
    return list
      .filter(u => u.type === 'usage')
      .reduce((sum, curr) => sum + Math.abs(curr.amount), 0)
  }, [creditUsage])

  const costByService = useMemo(() => {
    const list = Array.isArray(creditUsage) ? creditUsage : []
    const breakdown: Record<string, number> = {}
    list.forEach(usage => {
      if (usage.type === 'usage' && usage.service) {
        breakdown[usage.service] = (breakdown[usage.service] || 0) + Math.abs(usage.amount)
      }
    })

    return Object.entries(breakdown)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(6)) }))
      .sort((a, b) => b.value - a.value)
  }, [creditUsage])

  const dailySpend = useMemo(() => {
    const list = Array.isArray(creditUsage) ? creditUsage : []
    const days: Record<string, number> = {}

    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days[d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })] = 0
    }

    list.forEach(usage => {
      if (usage.type === 'usage') {
        const dateStr = new Date(usage.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
        if (days[dateStr] !== undefined) {
          days[dateStr] += Math.abs(usage.amount)
        }
      }
    })

    return Object.entries(days).map(([date, amount]) => ({
      date,
      amount: Number(amount.toFixed(4)),
    }))
  }, [creditUsage])

  const totalTokens = useMemo(() => {
    const list = Array.isArray(creditUsage) ? creditUsage : []
    return list.reduce((sum, u) => {
      const m = u.metadata || {}
      const t = m.total_tokens
        ?? ((m.prompt_tokens ?? m.tokens_prompt ?? 0) + (m.completion_tokens ?? m.tokens_completion ?? 0))
      return sum + (typeof t === 'number' ? t : 0)
    }, 0)
  }, [creditUsage])

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h2 className="text-2xl font-semibold text-text-primary tracking-tight">Credit Usage</h2>
        <p className="text-[14px] text-text-secondary mt-1">
          Estimated API spend by provider — tokens, characters, and call minutes.
        </p>
      </div>

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
            <h3 className="text-[13px] font-medium text-text-secondary uppercase tracking-wider">Est. Spend (all)</h3>
          </div>
          <p className="text-3xl font-semibold text-text-primary tabular-nums">{usd(totalSpent, 3)}</p>
          {totalTokens > 0 && (
            <p className="text-[12px] text-text-muted mt-2 tabular-nums">
              {totalTokens.toLocaleString()} tokens tracked
            </p>
          )}
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
          {costByService.length > 0 && (
            <p className="text-[12px] text-text-muted mt-2 tabular-nums">
              {usd(costByService[0].value, 3)}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-surface-card p-6 rounded-2xl border border-border shadow-sm lg:col-span-1 min-h-87.5 flex flex-col">
          <h3 className="text-[15px] font-semibold text-text-primary mb-6">Cost by API</h3>

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
                  formatter={(value: any) => [usd(Number(value), 4), 'Est. cost']}
                  contentStyle={{ backgroundColor: 'var(--color-surface-card)', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '13px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)', color: 'var(--color-text-primary)' }}
                  itemStyle={{ color: 'var(--color-text-primary)' }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="mt-4 w-full space-y-2">
              {costByService.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: SERVICE_COLORS[entry.name] || SERVICE_COLORS.platform }} />
                    <span className="text-[12px] text-text-secondary capitalize">{entry.name}</span>
                  </div>
                  <span className="text-[12px] font-medium text-text-primary tabular-nums">{usd(entry.value, 4)}</span>
                </div>
              ))}
              {costByService.length === 0 && (
                <p className="text-[12px] text-text-muted">No usage yet</p>
              )}
            </div>
          </div>
        </div>

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
                  formatter={(value: any) => [usd(Number(value), 4), 'Spend']}
                />
                <Bar dataKey="amount" fill="var(--color-accent)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-surface-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-semibold text-text-primary">Detailed Usage Logs</h3>
            <p className="text-[12px] text-text-muted mt-1">
              Costs are estimated from list rates (tokens / chars / minutes), not vendor invoices.
            </p>
          </div>
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
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border">API</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border">Description</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border">Usage details</th>
                  <th className="px-6 py-4 text-right text-[12px] font-semibold text-text-secondary uppercase tracking-wider border-b border-border">Est. cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {creditUsage.map((usage) => {
                  const chips = formatMetrics(usage)
                  return (
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
                      <td className="px-6 py-4 text-[13px] text-text-secondary max-w-xs">
                        <span className="line-clamp-2">{usage.description}</span>
                      </td>
                      <td className="px-6 py-4">
                        {chips.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {chips.slice(0, 3).map((chip) => (
                              <MetricChip key={chip} label={chip} />
                            ))}
                          </div>
                        ) : (
                          <span className="text-[13px] text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className={`text-[13px] font-medium tabular-nums ${usage.type === 'usage' ? 'text-text-primary' : 'text-emerald-600'}`}>
                          {usage.type === 'usage' ? '−' : '+'}{usd(usage.amount, 4)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default UsagePage
