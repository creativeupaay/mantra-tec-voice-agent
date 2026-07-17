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
    <div>
      <h1 className="text-2xl font-bold mb-6">Credit Usage</h1>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-slate-600">Loading...</div>
        ) : creditUsage.length === 0 ? (
          <div className="p-6 text-center text-slate-600">No credit usage records found.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {creditUsage.map((usage) => (
                <tr key={usage._id}>
                  <td className="px-6 py-4 text-sm text-slate-800">
                    {typeof usage.userId === 'object' ? usage.userId.email : usage.userId}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-800">{usage.amount}</td>
                  <td className="px-6 py-4 text-sm text-slate-700">{usage.description}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      usage.type === 'usage' ? 'bg-blue-100 text-blue-800' :
                      usage.type === 'purchase' ? 'bg-green-100 text-green-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {usage.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
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