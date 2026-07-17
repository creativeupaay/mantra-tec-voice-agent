import { FC } from 'react'

const SettingsPage: FC = () => {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-slate-800 mb-6">Settings</h2>
      
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex">
            <button className="px-4 py-3 text-sm font-medium border-b-2 border-slate-800 text-slate-800">
              General
            </button>
            <button className="px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-800">
              API Keys
            </button>
            <button className="px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-800">
              Team
            </button>
          </nav>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Organization Name
            </label>
            <input
              type="text"
              defaultValue="Mantra Tech"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Default API Endpoint
            </label>
            <input
              type="text"
              placeholder="https://api.mantratech.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Session Timeout (minutes)
            </label>
            <input
              type="number"
              defaultValue="30"
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
          </div>
          
          <div className="pt-4">
            <button className="px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 text-sm">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage