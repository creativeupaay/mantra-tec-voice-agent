import { Request, Response, NextFunction } from 'express'
import mongoose from 'mongoose'
import { Feedback, FeedbackStatus } from '../models/Feedback.js'
import { Call } from '../models/Call.js'

/**
 * Create new feedback.
 * Can be linked to a specific call (optional) or general.
 */
export const createFeedback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { content, call_id, status = 'pending', category = 'general' } = req.body

    let linkedCallDocId: mongoose.Types.ObjectId | undefined
    let resolvedCallIdString: string | undefined = call_id ? String(call_id).trim() : undefined

    // Resolve call if call_id is provided
    if (resolvedCallIdString) {
      let callDoc = null
      if (mongoose.Types.ObjectId.isValid(resolvedCallIdString)) {
        callDoc = await Call.findById(resolvedCallIdString).select('_id call_id')
      }
      if (!callDoc) {
        callDoc = await Call.findOne({ call_id: resolvedCallIdString }).select('_id call_id')
      }

      if (callDoc) {
        linkedCallDocId = callDoc._id as mongoose.Types.ObjectId
        resolvedCallIdString = callDoc.call_id
      }
    }

    const feedbackData: any = {
      content: content.trim(),
      status,
      category: category.trim(),
      call: linkedCallDocId,
      call_id: resolvedCallIdString,
    }

    // Attach user information if available
    if (req.user) {
      if (req.user._id && mongoose.Types.ObjectId.isValid(req.user._id)) {
        feedbackData.user_id = new mongoose.Types.ObjectId(req.user._id)
      }
      feedbackData.user_name = req.user.name || 'Admin User'
      feedbackData.user_email = req.user.email
    }

    // If initial status is resolved, set resolution info
    if (status === 'resolved') {
      feedbackData.resolved_at = new Date()
      feedbackData.resolved_by = req.user?.name || 'Admin'
    }

    const feedback = await Feedback.create(feedbackData)

    // Populate call information for client display
    const populatedFeedback = await Feedback.findById(feedback._id)
      .populate('call', '_id call_id caller_name phone_number timestamp status duration')
      .lean()

    res.status(201).json({
      success: true,
      data: populatedFeedback,
      message: 'Feedback submitted successfully',
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get paginated feedbacks with text search, status filtering, and optional call_id filtering.
 */
export const getFeedbacks = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10))
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '10'), 10)))
    const status = String(req.query.status || 'all')
    const search = req.query.search ? String(req.query.search).trim() : ''
    const callIdQuery = req.query.call_id ? String(req.query.call_id).trim() : ''

    const queryConditions: any[] = []

    // Status filter
    if (status && status !== 'all') {
      queryConditions.push({ status })
    }

    // Specific Call filter
    if (callIdQuery) {
      const isObjectId = mongoose.Types.ObjectId.isValid(callIdQuery)
      queryConditions.push({
        $or: [
          { call_id: callIdQuery },
          ...(isObjectId ? [{ call: new mongoose.Types.ObjectId(callIdQuery) }] : []),
        ],
      })
    }

    // Search filter across content, user_name, user_email, call_id, resolution_notes
    if (search) {
      const searchRegex = new RegExp(search, 'i')
      queryConditions.push({
        $or: [
          { content: searchRegex },
          { user_name: searchRegex },
          { user_email: searchRegex },
          { call_id: searchRegex },
          { resolution_notes: searchRegex },
          { category: searchRegex },
        ],
      })
    }

    const filter = queryConditions.length > 0 ? { $and: queryConditions } : {}

    // Base scope for status tab counters (respect call_id if supplied so per-call tabs work)
    const countScope = callIdQuery
      ? {
          $or: [
            { call_id: callIdQuery },
            ...(mongoose.Types.ObjectId.isValid(callIdQuery)
              ? [{ call: new mongoose.Types.ObjectId(callIdQuery) }]
              : []),
          ],
        }
      : {}

    const [total, pendingCount, inprogressCount, resolvedCount, totalScoped] =
      await Promise.all([
        Feedback.countDocuments(filter),
        Feedback.countDocuments({ ...countScope, status: 'pending' }),
        Feedback.countDocuments({ ...countScope, status: 'inprogress' }),
        Feedback.countDocuments({ ...countScope, status: 'resolved' }),
        Feedback.countDocuments(countScope),
      ])

    const skip = (page - 1) * limit
    const feedbacks = await Feedback.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('call', '_id call_id caller_name phone_number timestamp status duration')
      .lean()

    const pages = Math.ceil(total / limit) || 1

    res.json({
      success: true,
      data: feedbacks,
      pagination: {
        total,
        page,
        limit,
        pages,
        hasNextPage: page < pages,
        hasPreviousPage: page > 1,
      },
      counts: {
        all: totalScoped,
        pending: pendingCount,
        inprogress: inprogressCount,
        resolved: resolvedCount,
      },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get single feedback by ID.
 */
export const getFeedbackById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = String(req.params.id)
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid feedback ID format' })
      return
    }

    const feedback = await Feedback.findById(id)
      .populate('call', '_id call_id caller_name phone_number timestamp status duration')
      .lean()

    if (!feedback) {
      res.status(404).json({ success: false, message: 'Feedback not found' })
      return
    }

    res.json({ success: true, data: feedback })
  } catch (error) {
    next(error)
  }
}

/**
 * Update feedback status (pending, inprogress, resolved) and optional resolution notes.
 */
export const updateFeedbackStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = String(req.params.id)
    const { status, resolution_notes } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid feedback ID format' })
      return
    }

    const updateFields: any = { status }
    if (resolution_notes !== undefined) {
      updateFields.resolution_notes = resolution_notes.trim()
    }

    if (status === 'resolved') {
      updateFields.resolved_at = new Date()
      updateFields.resolved_by = req.user?.name || 'Admin'
    } else {
      updateFields.resolved_at = null
      updateFields.resolved_by = null
    }

    const updatedFeedback = await Feedback.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    })
      .populate('call', '_id call_id caller_name phone_number timestamp status duration')
      .lean()

    if (!updatedFeedback) {
      res.status(404).json({ success: false, message: 'Feedback not found' })
      return
    }

    res.json({
      success: true,
      data: updatedFeedback,
      message: `Feedback status updated to ${status}`,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Delete feedback.
 */
export const deleteFeedback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = String(req.params.id)
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid feedback ID format' })
      return
    }

    const deleted = await Feedback.findByIdAndDelete(id)
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Feedback not found' })
      return
    }

    res.json({ success: true, message: 'Feedback deleted successfully' })
  } catch (error) {
    next(error)
  }
}
