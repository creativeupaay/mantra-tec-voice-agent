import { FC } from 'react'

const SettingsPage: FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-text-primary">Settings</h2>
      
      <div className="bg-surface-card rounded-2xl border border-border">
        <div className="border-b border-border px-4">
          <nav className="flex space-x-2">
            <button className="px-3 py-3.5 text-[14px] font-medium border-b-2 border-text-primary text-text-primary">
              General
            </button>
            <button className="px-3 py-3.5 text-[14px] font-medium text-text-secondary hover:text-text-primary border-b-2 border-transparent hover:border-border-strong transition-colors">
              API Keys
            </button>
            <button className="px-3 py-3.5 text-[14px] font-medium text-text-secondary hover:text-text-primary border-b-2 border-transparent hover:border-border-strong transition-colors">
              Team
            </button>
          </nav>
        </div>
        
        <div className="p-6 max-w-2xl space-y-6">
          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
              Organization Name
            </label>
            <input
              type="text"
              defaultValue="Mantra Tech"
              className="w-full px-3 py-2.5 bg-transparent border border-border rounded-lg focus:outline-none focus:border-text-primary text-[14px] text-text-primary transition-colors"
            />
          </div>
          
          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
              Default API Endpoint
            </label>
            <input
              type="text"
              placeholder="https://api.mantratech.com"
              className="w-full px-3 py-2.5 bg-transparent border border-border rounded-lg focus:outline-none focus:border-text-primary text-[14px] text-text-primary transition-colors"
            />
          </div>
          
          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
              Session Timeout (minutes)
            </label>
            <input
              type="number"
              defaultValue="30"
              className="w-full px-3 py-2.5 bg-transparent border border-border rounded-lg focus:outline-none focus:border-text-primary text-[14px] text-text-primary transition-colors"
            />
          </div>
          
          <div className="pt-2">
            <button className="px-5 py-2.5 bg-text-primary text-surface-card rounded-lg hover:bg-black text-[13px] font-medium transition-colors">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage