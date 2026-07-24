import { Request, Response, NextFunction } from 'express'
import { Call } from '../models/Call.js'

/** Normalize call docs so the client always receives complete UI fields. */
function normalizeCall(call: Record<string, any>) {
  const isFlagged = Boolean(call.is_red_flag || call.is_red_flagged)
  return {
    ...call,
    status: call.status || 'live',
    is_red_flag: isFlagged,
    is_red_flagged: isFlagged,
    call_category: call.call_category || 'inquiry',
    duration: typeof call.duration === 'number' ? call.duration : undefined,
  }
}

// Get all calls
export const getAllCalls = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const calls = await Call.find()
      .sort({ timestamp: -1 })
      .limit(100)
      .lean()
    
    res.json({
      success: true,
      data: calls.map((call) => normalizeCall(call as Record<string, any>))
    })
  } catch (error) {
    next(error)
  }
}

// Get call by ID
export const getCallById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const call = await Call.findById(req.params.id).lean()
    
    if (!call) {
      res.status(404).json({ success: false, message: 'Call not found' })
      return
    }
    
    res.json({
      success: true,
      data: normalizeCall(call as Record<string, any>)
    })
  } catch (error) {
    next(error)
  }
}

// Get call recording (redirect to recording URL or serve presigned URL)
export const getCallRecording = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const call = await Call.findById(req.params.id).lean()
    
    if (!call) {
      res.status(404).json({ success: false, message: 'Call not found' })
      return
    }
    
    if (!call.recording_url) {
      res.status(404).json({ success: false, message: 'No recording available' })
      return
    }
    
    // Return the recording URL
    res.json({
      success: true,
      data: {
        recording_url: call.recording_url,
        call_id: call.call_id
      }
    })
  } catch (error) {
    next(error)
  }
}
