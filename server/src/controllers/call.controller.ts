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
