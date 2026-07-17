import { FC, useEffect, useState } from 'react'
import { callApi } from '../api/client'

interface ICall {
  _id: string
  call_id: string
  phone_number: string
  duration?: number
  recording_url?: string
  transcript?: string
  call_summary?: string
  detected_intent?: string
  timestamp: string
}

const CallsPage: FC = () => {
  const [calls, setCalls] = useState<ICall[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCall, setSelectedCall] = useState<ICall | null>(null)

  useEffect(() => {
    callApi.getAll()
      .then(res => {
        setCalls(Array.isArray(res.data.data) ? res.data.data : [])
      })
      .catch(() => setCalls([]))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div>
      <h2 className="text-2xl font-semibold text-slate-800 mb-6">Calls</h2>
      
      {isLoading ? (
        <div className="text-center py-8 text-slate-600">Loading...</div>
      ) : calls.length === 0 ? (
        <div className="text-center py-8 text-slate-600">No calls recorded yet.</div>
      ) : (
        <div className="space-y-4">
          {/* Calls List */}
          <div className="bg-white rounded-lg border border-slate-200">
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Call ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Recording</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {calls.map((call) => (
                  <tr key={call.call_id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedCall(call)}>
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">{call.call_id.slice(0, 8)}...</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{call.phone_number}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {call.recording_url ? (
                        <audio controls className="w-32 h-8">
                          <source src={call.recording_url} type="audio/mpeg" />
                          Your browser does not support the audio element.
                        </audio>
                      ) : (
                        <span className="text-xs text-slate-500">No recording</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {new Date(call.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Call Details Modal */}
          {selectedCall && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedCall(null)}>
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-4">Call Details: {selectedCall.call_id.slice(0, 8)}...</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Phone Number</label>
                    <p className="text-slate-800">{selectedCall.phone_number}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-600">Duration</label>
                    <p className="text-slate-800">{selectedCall.duration ? `${Math.floor(selectedCall.duration / 60)}m ${selectedCall.duration % 60}s` : '-'}</p>
                  </div>
                  
                  {selectedCall.recording_url && (
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">Recording</label>
                      <audio controls className="w-full">
                        <source src={selectedCall.recording_url} type="audio/mpeg" />
                      </audio>
                    </div>
                  )}
                  
                  {selectedCall.call_summary && (
                    <div>
                      <label className="block text-sm font-medium text-slate-600">Summary</label>
                      <p className="text-slate-800 mt-1">{selectedCall.call_summary}</p>
                    </div>
                  )}
                  
                  {selectedCall.transcript && (
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-2">Transcript</label>
                      <div className="bg-slate-50 p-3 rounded-md max-h-48 overflow-y-auto">
                        <pre className="text-sm text-slate-700 whitespace-pre-wrap">{selectedCall.transcript}</pre>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 flex justify-end">
                  <button 
                    onClick={() => setSelectedCall(null)}
                    className="px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CallsPage