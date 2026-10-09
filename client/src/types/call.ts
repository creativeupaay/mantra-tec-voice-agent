export type CallStatus = 'live' | 'resolved' | 'escalated' | 'missed' | 'callback_required'

export type CallCategory = 'support' | 'sales' | 'booking' | 'inquiry' | 'feedback' | 'complaint' | 'technical' | 'billing'

export interface ICall {
  _id: string
  call_id: string
  caller_name?: string
  phone_number: string
  duration?: number
  status: CallStatus
  is_red_flag: boolean
  is_red_flagged?: boolean
  is_reviewed?: boolean
  reviewed_at?: string
  reviewed_by?: string
  call_category?: CallCategory
  red_flag_reason?: string
  guardrail_triggered?: string
  recording_url?: string
  recording_path?: string
  transcript?: string
  call_summary?: string
  call_outcome?: string
  detected_intent?: string
  timestamp: string
}

export interface ICallListResponse {
  success: boolean
  data: ICall[]
  pagination?: {
    total: number
    page: number
    limit: number
    pages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  counts?: {
    escalated: number
    resolved: number
    callback_required?: number
    reviewed?: number
    unreviewed?: number
  }
}

export interface ICallResponse {
  success: boolean
  data: ICall
}
