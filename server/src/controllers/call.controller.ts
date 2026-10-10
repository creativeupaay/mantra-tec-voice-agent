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
import {
  sendEscalationEmailNotification,
  sendCallbackEmailNotification,
} from '../services/email.service.js'

/** Normalize call docs so the client always receives complete UI fields. */
function normalizeCall(call: Record<string, any>) {
  const isFlagged = Boolean(call.is_red_flag || call.is_red_flagged)
  const hasRecording = Boolean(call.recording_path || call.recording_url)

  return {
    ...call,
    status: call.status || 'live',
    is_red_flag: isFlagged,
    is_red_flagged: isFlagged,
    is_reviewed: Boolean(call.is_reviewed),
    reviewed_at: call.reviewed_at ? new Date(call.reviewed_at).toISOString() : undefined,
    reviewed_by: call.reviewed_by || undefined,
    call_category: call.call_category || 'inquiry',
    duration: typeof call.duration === 'number' ? call.duration : undefined,
    // Client streams via authenticated backend proxy
    recording_url: hasRecording
      ? `/api/v1/calls/${call._id}/recording`
      : undefined,
  }
}

// Safely parse any date input (ISO, Date object, or custom string like "05 Aug 2026 06:39 pm IST")
function getCallTime(call: Record<string, any>): number {
  const ts = call.timestamp || call.createdAt
  if (!ts) return 0
  if (ts instanceof Date) return isNaN(ts.getTime()) ? 0 : ts.getTime()
  if (typeof ts === 'number') return ts < 1e11 ? ts * 1000 : ts
  if (typeof ts === 'string') {
    let str = ts.trim()
    if (!str) return 0
    if (/^\d+$/.test(str)) {
      const num = parseInt(str, 10)
      return num < 1e11 ? num * 1000 : num
    }
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(str)) {
      str = str.replace(' ', 'T')
    }
    const d = new Date(str)
    if (!isNaN(d.getTime())) return d.getTime()
  }
  return 0
}

function getDatePresetRange(preset: string, dateFrom?: string, dateTo?: string): { startMs: number | null; endMs: number | null } {
  if (!preset || preset === 'all') return { startMs: null, endMs: null }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  if (preset === 'today') {
    return { startMs: todayStart.getTime(), endMs: todayEnd.getTime() }
  }

  if (preset === 'yesterday') {
    const yStart = new Date(todayStart)
    yStart.setDate(yStart.getDate() - 1)
    const yEnd = new Date(todayEnd)
    yEnd.setDate(yEnd.getDate() - 1)
    return { startMs: yStart.getTime(), endMs: yEnd.getTime() }
  }

  if (preset === 'last_7_days') {
    const s = new Date(todayStart)
    s.setDate(s.getDate() - 6)
    return { startMs: s.getTime(), endMs: todayEnd.getTime() }
  }

  if (preset === 'last_30_days') {
    const s = new Date(todayStart)
    s.setDate(s.getDate() - 29)
    return { startMs: s.getTime(), endMs: todayEnd.getTime() }
  }

  if (preset === 'custom') {
    let startMs: number | null = null
    let endMs: number | null = null
    if (dateFrom) {
      const d = new Date(`${dateFrom}T00:00:00`)
      if (!isNaN(d.getTime())) startMs = d.getTime()
    }
    if (dateTo) {
      const d = new Date(`${dateTo}T23:59:59.999`)
      if (!isNaN(d.getTime())) endMs = d.getTime()
    }
    return { startMs, endMs }
  }

  return { startMs: null, endMs: null }
}

// Get all calls with backend pagination, search, status, and date range filters
export const getAllCalls = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
    const limit = Math.max(1, Math.min(1000, parseInt(req.query.limit as string, 10) || 10))
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'all'
    const intent = typeof req.query.intent === 'string' ? req.query.intent.trim() : 'all'
    const reviewed = typeof req.query.reviewed === 'string' ? req.query.reviewed.trim().toLowerCase() : 'all'
    const datePreset = typeof req.query.datePreset === 'string' ? req.query.datePreset.trim() : 'all'
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : ''
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : ''
    const callIdParam = typeof req.query.callId === 'string' ? req.query.callId.trim() : ''

    // 1. If explicit callId is passed, return single direct match
    if (callIdParam) {
      let singleCall = null
      if (/^[a-f\d]{24}$/i.test(callIdParam)) {
        singleCall = await Call.findById(callIdParam).lean()
      }
      if (!singleCall) {
        singleCall = await Call.findOne({ call_id: callIdParam }).lean()
      }
      if (singleCall) {
        const normalized = normalizeCall(singleCall as Record<string, any>)
        res.json({
          success: true,
          data: [normalized],
          pagination: {
            total: 1,
            page: 1,
            limit,
            pages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          counts: { escalated: 0, resolved: 0, callback_required: 0, reviewed: 0, unreviewed: 0 },
        })
        return
      }
    }

    // 2. Build MongoDB query filter for search, status, intent, and review status
    const queryConditions: any[] = []

    if (search) {
      const searchRegex = new RegExp(search, 'i')
      queryConditions.push({
        $or: [
          { caller_name: searchRegex },
          { phone_number: searchRegex },
          { call_id: searchRegex },
          { detected_intent: searchRegex },
          { call_category: searchRegex },
          { call_summary: searchRegex },
          { red_flag_reason: searchRegex },
          { guardrail_triggered: searchRegex },
        ],
      })
    }

    if (status && status !== 'all') {
      if (status === 'flagged') {
        queryConditions.push({
          $or: [{ is_red_flag: true }, { is_red_flagged: true }],
        })
      } else {
        queryConditions.push({ status })
      }
    }

    if (intent && intent !== 'all') {
      queryConditions.push({ detected_intent: intent })
    }

    if (reviewed && reviewed !== 'all') {
      if (reviewed === 'reviewed' || reviewed === 'true') {
        queryConditions.push({ is_reviewed: true })
      } else if (reviewed === 'unreviewed' || reviewed === 'false') {
        queryConditions.push({
          $or: [{ is_reviewed: false }, { is_reviewed: { $exists: false } }],
        })
      }
    }

    const filter = queryConditions.length > 0 ? { $and: queryConditions } : {}

    // Tab counts for status header & review status
    const [escalatedCount, resolvedCount, callbackCount, reviewedCount, unreviewedCount] = await Promise.all([
      Call.countDocuments({ status: 'escalated' }),
      Call.countDocuments({ status: 'resolved' }),
      Call.countDocuments({ status: 'callback_required' }),
      Call.countDocuments({ is_reviewed: true }),
      Call.countDocuments({ $or: [{ is_reviewed: false }, { is_reviewed: { $exists: false } }] }),
    ])

    // Query Mongo documents
    const rawCalls = await Call.find(filter).lean()
    let normalized = rawCalls.map(c => normalizeCall(c as Record<string, any>))

    // Apply Date Range Preset filter (robust against string or Date formats)
    const { startMs, endMs } = getDatePresetRange(datePreset, dateFrom, dateTo)
    if (startMs !== null || endMs !== null) {
      normalized = normalized.filter(call => {
        const time = getCallTime(call)
        const matchStart = startMs === null || time >= startMs
        const matchEnd = endMs === null || time <= endMs
        return matchStart && matchEnd
      })
    }

    // Sort strictly by newest call FIRST
    normalized.sort((a, b) => getCallTime(b) - getCallTime(a))

    // Calculate pagination over filtered dataset
    const totalCalls = normalized.length
    const totalPages = Math.max(1, Math.ceil(totalCalls / limit))
    const currentPage = Math.min(page, totalPages)
    const startIndex = (currentPage - 1) * limit
    const pageCalls = normalized.slice(startIndex, startIndex + limit)

    res.json({
      success: true,
      data: pageCalls,
      pagination: {
        total: totalCalls,
        page: currentPage,
        limit,
        pages: totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
      counts: {
        escalated: escalatedCount,
        resolved: resolvedCount,
        callback_required: callbackCount,
        reviewed: reviewedCount,
        unreviewed: unreviewedCount,
      },
    })
  } catch (error) {
    next(error)
  }
}

// Get call by ID (supports Mongo _id or call_id string)
export const getCallById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = String(req.params.id || '')
    let call = null
    if (/^[a-f\d]{24}$/i.test(id)) {
      call = await Call.findById(id).lean()
    }
    if (!call) {
      call = await Call.findOne({ call_id: id }).lean()
    }

    if (!call) {
      res.status(404).json({ success: false, message: 'Call not found' })
      return
    }

    res.json({
      success: true,
      data: normalizeCall(call as Record<string, any>),
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

// Update call status (and optionally review status)
export const updateCallStatus = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  try {
    const id = (req.params.id as string || '').trim()
    const { status, is_reviewed } = req.body

    if (!id) {
      res.status(400).json({ success: false, message: 'Call ID is required' })
      return
    }

    const validStatuses = ['live', 'resolved', 'escalated', 'missed', 'callback_required']
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: `Invalid status: "${status}". Must be one of: ${validStatuses.join(', ')}` })
      return
    }

    if (!status && typeof is_reviewed !== 'boolean') {
      res.status(400).json({ success: false, message: 'Either status or is_reviewed must be provided' })
      return
    }

    const isObjectId = /^[a-f\d]{24}$/i.test(id)
    const filter = isObjectId ? { _id: id } : { call_id: id }

    const existing = await Call.findOne(filter).lean()
    if (!existing) {
      res.status(404).json({ success: false, message: `Call not found for ID: ${id}` })
      return
    }

    const updateSet: Record<string, any> = {}
    if (status) {
      updateSet.status = status
    }
    if (typeof is_reviewed === 'boolean') {
      const reviewerIdentity = (req as any).user?.name || (req as any).user?.email || 'Admin'
      updateSet.is_reviewed = is_reviewed
      updateSet.reviewed_at = is_reviewed ? new Date() : null
      updateSet.reviewed_by = is_reviewed ? reviewerIdentity : null
    }

    const updatedCall = await Call.findOneAndUpdate(
      filter,
      { $set: updateSet },
      { returnDocument: 'after' }
    ).lean()

    if (!updatedCall) {
      res.status(500).json({ success: false, message: 'MongoDB findOneAndUpdate failed to return updated document' })
      return
    }

    // If call status changed to 'escalated' or 'callback_required', trigger email notification asynchronously
    if (status === 'escalated') {
      sendEscalationEmailNotification(updatedCall as any).catch((err) => {
        console.error('[CallController] Failed to dispatch escalation email notification:', err)
      })
    } else if (status === 'callback_required') {
      sendCallbackEmailNotification(updatedCall as any).catch((err) => {
        console.error('[CallController] Failed to dispatch callback email notification:', err)
      })
    }

    res.json({
      success: true,
      message: status ? `Call status updated to ${status}` : `Call marked as ${is_reviewed ? 'reviewed' : 'unreviewed'}`,
      data: normalizeCall(updatedCall as Record<string, any>),
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal Database Error during call status update',
      error: error.name || 'UnknownError',
    })
  }
}

// Update single call review status (mark as read/reviewed or unread)
export const updateCallReviewed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = (req.params.id as string || '').trim()
    const { is_reviewed } = req.body

    if (!id) {
      res.status(400).json({ success: false, message: 'Call ID is required' })
      return
    }

    if (typeof is_reviewed !== 'boolean') {
      res.status(400).json({ success: false, message: 'is_reviewed must be a boolean (true or false)' })
      return
    }

    const isObjectId = /^[a-f\d]{24}$/i.test(id)
    const filter = isObjectId ? { _id: id } : { call_id: id }

    const reviewerIdentity = (req as any).user?.name || (req as any).user?.email || 'Admin'

    const updateSet: Record<string, any> = {
      is_reviewed,
      reviewed_at: is_reviewed ? new Date() : null,
      reviewed_by: is_reviewed ? reviewerIdentity : null,
    }

    const updatedCall = await Call.findOneAndUpdate(
      filter,
      { $set: updateSet },
      { returnDocument: 'after' }
    ).lean()

    if (!updatedCall) {
      res.status(404).json({ success: false, message: `Call not found for ID: ${id}` })
      return
    }

    res.json({
      success: true,
      message: `Call marked as ${is_reviewed ? 'reviewed' : 'unreviewed'}`,
      data: normalizeCall(updatedCall as Record<string, any>),
    })
  } catch (error) {
    next(error)
  }
}

// Batch update call review status
export const batchUpdateCallReviewed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { call_ids, is_reviewed } = req.body

    if (!Array.isArray(call_ids) || call_ids.length === 0) {
      res.status(400).json({ success: false, message: 'call_ids must be a non-empty array of call IDs' })
      return
    }

    if (typeof is_reviewed !== 'boolean') {
      res.status(400).json({ success: false, message: 'is_reviewed must be a boolean (true or false)' })
      return
    }

    const reviewerIdentity = (req as any).user?.name || (req as any).user?.email || 'Admin'

    const updateSet: Record<string, any> = {
      is_reviewed,
      reviewed_at: is_reviewed ? new Date() : null,
      reviewed_by: is_reviewed ? reviewerIdentity : null,
    }

    const objectIds = call_ids.filter((id: string) => /^[a-f\d]{24}$/i.test(id))
    const filter = {
      $or: [
        { _id: { $in: objectIds } },
        { call_id: { $in: call_ids } },
      ],
    }

    const result = await Call.updateMany(filter, { $set: updateSet })

    res.json({
      success: true,
      message: `Successfully marked ${result.modifiedCount} call(s) as ${is_reviewed ? 'reviewed' : 'unreviewed'}`,
      modifiedCount: result.modifiedCount,
    })
  } catch (error) {
    next(error)
  }
}
