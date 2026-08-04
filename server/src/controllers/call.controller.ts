import { Request, Response, NextFunction } from 'express'
import { Call } from '../models/Call.js'
import {
  getRecordingObject,
  isGcsConfigured,
  resolveRecordingObjectPath,
} from '../services/gcs.service.js'

/** Normalize call docs so the client always receives complete UI fields. */
function normalizeCall(call: Record<string, any>) {
  const isFlagged = Boolean(call.is_red_flag || call.is_red_flagged)
  const hasRecording = Boolean(call.recording_path || call.recording_url)

  return {
    ...call,
    status: call.status || 'live',
    is_red_flag: isFlagged,
    is_red_flagged: isFlagged,
    call_category: call.call_category || 'inquiry',
    duration: typeof call.duration === 'number' ? call.duration : undefined,
    // Do not expose private GCS URLs — client streams via authenticated proxy.
    // Keep a truthy recording_url so existing UI "has recording?" checks still work.
    recording_url: hasRecording
      ? `/api/v1/calls/${call._id}/recording`
      : undefined,
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

/**
 * Stream a call recording from the private GCS bucket (ADC).
 * Supports HTTP Range requests for seeking in media players.
 */
export const getCallRecording = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!isGcsConfigured()) {
      res.status(503).json({
        success: false,
        message: 'Recording storage is not configured (GCS_BUCKET_NAME)',
      })
      return
    }

    const call = await Call.findById(req.params.id).lean()

    if (!call) {
      res.status(404).json({ success: false, message: 'Call not found' })
      return
    }

    const objectPath = resolveRecordingObjectPath(call)

    if (!objectPath) {
      res.status(404).json({ success: false, message: 'No recording available' })
      return
    }

    const recording = await getRecordingObject(objectPath)

    if (!recording) {
      res.status(404).json({ success: false, message: 'Recording file not found in storage' })
      return
    }

    const { file, contentType, size } = recording
    const rangeHeader = req.headers.range

    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader(
      'Content-Disposition',
      `inline; filename="recording-${call.call_id || call._id}"`,
    )

    // Partial content for seeking
    if (rangeHeader && size > 0) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)

      if (!match) {
        res.status(416).setHeader('Content-Range', `bytes */${size}`).end()
        return
      }

      const start = match[1] ? parseInt(match[1], 10) : 0
      const end = match[2] ? parseInt(match[2], 10) : size - 1

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
        res.status(416).setHeader('Content-Range', `bytes */${size}`).end()
        return
      }

      const safeEnd = Math.min(end, size - 1)
      const chunkSize = safeEnd - start + 1

      res.status(206)
      res.setHeader('Content-Range', `bytes ${start}-${safeEnd}/${size}`)
      res.setHeader('Content-Length', chunkSize)

      const stream = file.createReadStream({ start, end: safeEnd })
      stream.on('error', (err) => {
        console.error('[GCS] Stream error:', err)
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Failed to stream recording' })
        } else {
          res.destroy(err)
        }
      })
      stream.pipe(res)
      return
    }

    if (size > 0) {
      res.setHeader('Content-Length', size)
    }

    const stream = file.createReadStream()
    stream.on('error', (err) => {
      console.error('[GCS] Stream error:', err)
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Failed to stream recording' })
      } else {
        res.destroy(err)
      }
    })
    stream.pipe(res)
  } catch (error) {
    next(error)
  }
}

// Update call status (e.g. resolve call)
export const updateCallStatus = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  try {
    const id = (req.params.id as string || '').trim()
    const { status } = req.body

    console.log('[DEBUG updateCallStatus] Request URL:', req.originalUrl)
    console.log('[DEBUG updateCallStatus] Params ID:', id)
    console.log('[DEBUG updateCallStatus] Body:', req.body)

    if (!id) {
      res.status(400).json({ success: false, message: 'Call ID is required' })
      return
    }

    const validStatuses = ['live', 'resolved', 'escalated', 'missed']
    if (!status || !validStatuses.includes(status)) {
      console.warn('[DEBUG updateCallStatus] Invalid status requested:', status)
      res.status(400).json({ success: false, message: `Invalid status: "${status}". Must be one of: ${validStatuses.join(', ')}` })
      return
    }

    const isObjectId = /^[a-f\d]{24}$/i.test(id)
    const filter = isObjectId ? { _id: id } : { call_id: id }
    console.log('[DEBUG updateCallStatus] MongoDB Query Filter:', JSON.stringify(filter))

    // Query existing record to log current state
    const existing = await Call.findOne(filter).lean()
    console.log('[DEBUG updateCallStatus] Existing Document in DB:', existing ? { id: existing._id, status: existing.status } : 'NOT FOUND IN DB')

    if (!existing) {
      console.warn('[DEBUG updateCallStatus] Document not found in MongoDB for filter:', filter)
      res.status(404).json({ success: false, message: `Call not found for ID: ${id}` })
      return
    }

    const updatedCall = await Call.findOneAndUpdate(
      filter,
      { $set: { status } },
      { returnDocument: 'after' }
    ).lean()

    console.log('[DEBUG updateCallStatus] MongoDB Update Success:', updatedCall ? { id: updatedCall._id, newStatus: updatedCall.status } : 'NULL')

    if (!updatedCall) {
      res.status(500).json({ success: false, message: 'MongoDB findOneAndUpdate failed to return updated document' })
      return
    }

    res.json({
      success: true,
      message: `Call status updated to ${status}`,
      data: normalizeCall(updatedCall as Record<string, any>),
    })
  } catch (error: any) {
    console.error('[DEBUG updateCallStatus EXCEPTION]:', error.stack || error)
    res.status(500).json({
      success: false,
      message: error.message || 'Internal Database Error during call resolution',
      error: error.name || 'UnknownError',
    })
  }
}

