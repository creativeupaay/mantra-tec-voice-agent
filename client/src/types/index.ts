export interface IUser {
  id: string
  email: string
  name: string
  role?: string
}

export interface IAgent {
  _id: string
  name: string
  description: string
  isActive: boolean
}

export interface ISession {
  _id: string
  agentId: string
  duration?: number
  status: 'active' | 'completed' | 'failed'
}