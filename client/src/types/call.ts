export type CallStatus = 'live' | 'resolved' | 'escalated' | 'missed'

export interface ICall {
  _id: string
  call_id: string
  caller_name?: string
  phone_number: string
  duration?: number
  status: CallStatus
  is_red_flag: boolean
  recording_url?: string
  transcript?: string
  call_summary?: string
  call_outcome?: string
  detected_intent?: string
  timestamp: string
}

export interface ICallListResponse {
  success: boolean
  data: ICall[]
}

export interface ICallResponse {
  success: boolean
  data: ICall
}

export interface ICallRecordingResponse {
  success: boolean
  data: {
    recording_url: string
  }
}
