export type FeedbackStatus = 'pending' | 'inprogress' | 'resolved'

export interface IFeedbackCallInfo {
  _id: string
  call_id: string
  caller_name?: string
  phone_number: string
  timestamp?: string
  status?: string
  duration?: number
}

export interface IFeedback {
  _id: string
  call?: IFeedbackCallInfo
  call_id?: string
  content: string
  status: FeedbackStatus
  category?: string
  user_id?: string
  user_name?: string
  user_email?: string
  resolution_notes?: string
  resolved_by?: string
  resolved_at?: string
  createdAt: string
  updatedAt: string
}

export interface IFeedbackPagination {
  total: number
  page: number
  limit: number
  pages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface IFeedbackCounts {
  all: number
  pending: number
  inprogress: number
  resolved: number
}

export interface IFeedbackListResponse {
  success: boolean
  data: IFeedback[]
  pagination: IFeedbackPagination
  counts: IFeedbackCounts
  message?: string
}

export interface IFeedbackResponse {
  success: boolean
  data: IFeedback
  message?: string
}

export interface ICreateFeedbackInput {
  content: string
  call_id?: string
  status?: FeedbackStatus
  category?: string
}
