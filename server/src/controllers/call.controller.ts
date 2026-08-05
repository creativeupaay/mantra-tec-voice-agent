import fs from 'fs'
import { Request, Response, NextFunction } from 'express'
import { Call } from '../models/Call.js'
import {
  getRecordingObject,
  isGcsConfigured,
  resolveRecordingObjectPath,
  getLocalRecordingPath,
  guessContentType,
  fetchPublicGcsRecording,
} from '../services/gcs.service.js'
import { env } from '../config/env.config.js'

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
    // Client streams via authenticated backend proxy
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
 * Stream a call recording from Google Cloud Storage bucket (mantra-tec) or local disk.
 * Supports HTTP Range requests for seeking in media players.
 */
export const getCallRecording = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const call = await Call.findById(req.params.id).lean()

    if (!call) {
      res.status(404).json({ success: false, message: 'Call record not found' })
      return
    }

    const objectPath = resolveRecordingObjectPath(call)

    if (!objectPath) {
      res.status(404).json({ success: false, message: 'No recording available for this call' })
      return
    }

    let gcsError: string | null = null

    // 1. Try streaming directly from Google Cloud Storage bucket via GCS SDK FIRST
    if (isGcsConfigured()) {
      try {
        const recording = await getRecordingObject(objectPath)

        if (recording) {
          const { file, contentType, size } = recording
          const rangeHeader = req.headers.range

          res.setHeader('Accept-Ranges', 'bytes')
          res.setHeader('Content-Type', contentType)
          res.setHeader('Cache-Control', 'private, no-store')
          res.setHeader(
            'Content-Disposition',
            `inline; filename="recording-${call.call_id || call._id}"`,
          )

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
            stream.on('error', (err: any) => {
              console.error('[GCS] Stream error:', err)
              if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'Failed to stream recording from GCS' })
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
          stream.on('error', (err: any) => {
            console.error('[GCS] Stream error:', err)
            if (!res.headersSent) {
              res.status(500).json({ success: false, message: 'Failed to stream recording from GCS' })
            } else {
              res.destroy(err)
            }
          })
          stream.pipe(res)
          return
        }
      } catch (err: any) {
        gcsError = err.message || String(err)
        console.warn(`[GCS] SDK fetch notice for ${objectPath}:`, gcsError)
      }

      // 1B. Try public HTTPS URL fetch if bucket objects are unblocked
      const publicRecording = await fetchPublicGcsRecording(objectPath)
      if (publicRecording) {
        const { data, contentType } = publicRecording
        res.setHeader('Accept-Ranges', 'bytes')
        res.setHeader('Content-Type', contentType)
        res.setHeader('Cache-Control', 'private, no-store')
        res.setHeader('Content-Length', data.length)
        res.setHeader(
          'Content-Disposition',
          `inline; filename="recording-${call.call_id || call._id}"`,
        )
        res.send(data)
        return
      }
    }

    // 2. Fall back to local filesystem if file exists on disk
    const localFilePath = getLocalRecordingPath(objectPath)
    if (localFilePath) {
      const stat = fs.statSync(localFilePath)
      const size = stat.size
      const contentType = guessContentType(localFilePath)
      const rangeHeader = req.headers.range

      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader(
        'Content-Disposition',
        `inline; filename="recording-${call.call_id || call._id}"`,
      )

      if (rangeHeader && size > 0) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)
        if (match) {
          const start = match[1] ? parseInt(match[1], 10) : 0
          const end = match[2] ? parseInt(match[2], 10) : size - 1
          if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end && start < size) {
            const safeEnd = Math.min(end, size - 1)
            const chunkSize = safeEnd - start + 1
            res.status(206)
            res.setHeader('Content-Range', `bytes ${start}-${safeEnd}/${size}`)
            res.setHeader('Content-Length', chunkSize)

            const stream = fs.createReadStream(localFilePath, { start, end: safeEnd })
            stream.pipe(res)
            return
          }
        }
      }

      if (size > 0) {
        res.setHeader('Content-Length', size)
      }

      const stream = fs.createReadStream(localFilePath)
      stream.pipe(res)
      return
    }

    // 3. Return informative error response if GCS access failed
    const errorMsg = gcsError
      ? `GCP authentication required to stream from bucket '${env.GCS_BUCKET_NAME}'`
      : `Recording file '${objectPath}' not found in GCS bucket '${env.GCS_BUCKET_NAME}' or local storage`

    res.status(404).json({
      success: false,
      message: errorMsg,
      gcs_error: gcsError,
    })
  } catch (error) {
    next(error)
  }
}

// Update call status
export const updateCallStatus = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  try {
    const id = (req.params.id as string || '').trim()
    const { status } = req.body

    if (!id) {
      res.status(400).json({ success: false, message: 'Call ID is required' })
      return
    }

    const validStatuses = ['live', 'resolved', 'escalated', 'missed']
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: `Invalid status: "${status}". Must be one of: ${validStatuses.join(', ')}` })
      return
    }

    const isObjectId = /^[a-f\d]{24}$/i.test(id)
    const filter = isObjectId ? { _id: id } : { call_id: id }

    const existing = await Call.findOne(filter).lean()
    if (!existing) {
      res.status(404).json({ success: false, message: `Call not found for ID: ${id}` })
      return
    }

    const updatedCall = await Call.findOneAndUpdate(
      filter,
      { $set: { status } },
      { returnDocument: 'after' }
    ).lean()

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
    res.status(500).json({
      success: false,
      message: error.message || 'Internal Database Error during call resolution',
      error: error.name || 'UnknownError',
    })
  }
}
