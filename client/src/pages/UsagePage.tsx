import { FC, useEffect, useState } from 'react'
import { analyticsApi } from '../api/client'

interface ICreditUsage {
  _id: string
  userId: { _id: string; name: string; email: string }
  amount: number
  description: string
  type: 'usage' | 'purchase' | 'refund'
  createdAt: string
}

const UsagePage: FC = () => {
  const [creditUsage, setCreditUsage] = useState<ICreditUsage[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    analyticsApi.getAllCreditUsage()
      .then(res => setCreditUsage(res.data.data))
      .catch(() => setCreditUsage([]))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">Credit Usage</h2>
      
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-[var(--color-text-secondary)] text-sm">Loading...</div>
        ) : creditUsage.length === 0 ? (
          <div className="p-12 text-center text-[var(--color-text-secondary)] text-sm">No credit usage records found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left text-[13px] font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">User</th>
                <th className="px-6 py-4 text-left text-[13px] font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">Amount</th>
                <th className="px-6 py-4 text-left text-[13px] font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">Description</th>
                <th className="px-6 py-4 text-left text-[13px] font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">Type</th>
                <th className="px-6 py-4 text-left text-[13px] font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {creditUsage.map((usage) => (
                <tr key={usage._id} className="hover:bg-[var(--color-surface-page)] transition-colors h-14">
                  <td className="px-6 py-3 text-sm font-medium text-[var(--color-text-primary)]">
                    {typeof usage.userId === 'object' ? usage.userId.email : usage.userId}
                  </td>
                  <td className="px-6 py-3 text-sm text-[var(--color-text-primary)] tabular-nums">{usage.amount}</td>
                  <td className="px-6 py-3 text-sm text-[var(--color-text-secondary)]">{usage.description}</td>
                  <td className="px-6 py-3">
                    <span className="px-2.5 py-1 text-[12px] font-medium rounded-full bg-[var(--color-surface-page)] border border-[var(--color-border)] text-[var(--color-text-secondary)] uppercase tracking-wider">
                      {usage.type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-[13px] text-[var(--color-text-secondary)] tabular-nums">
                    {new Date(usage.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default UsagePage