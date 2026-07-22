import { Request, Response, NextFunction } from 'express'
import { CreditUsage } from '../models/CreditUsage.js'
import { User } from '../models/User.js'
import { Call } from '../models/Call.js'

// ── Get platform overview analytics (super_admin only) ────────────────────────
export const getAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments()
    const totalAgents = await (await import('../models/VoiceAgent.js')).VoiceAgent.countDocuments()
    const totalSessions = await (await import('../models/Session.js')).Session.countDocuments()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentUsage = await CreditUsage.find({
      createdAt: { $gte: thirtyDaysAgo },
      type: 'usage'
    })

    const totalCreditsUsed = recentUsage.reduce((sum: number, record: any) => sum + record.amount, 0)

    const monthlyStats = await CreditUsage.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          totalUsed: { $sum: '$amount' }
        }
      },
      { $sort: { '_id': 1 } }
    ])

    res.json({
      success: true,
      data: { totalUsers, totalAgents, totalSessions, totalCreditsUsed, monthlyStats }
    })
  } catch (error) {
    next(error)
  }
}

// ── Get call performance analytics (admin + super_admin) ──────────────────────
export const getCallAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // ── 1. KPIs ───────────────────────────────────────────────────────────────
    const [totalCalls, statusCounts, durationResult, redFlagCount] = await Promise.all([
      Call.countDocuments(),

      Call.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),

      Call.aggregate([
        { $match: { duration: { $exists: true, $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$duration' } } }
      ]),

      Call.countDocuments({ is_red_flag: true })
    ])

    // Map status counts to named fields
    const statusMap: Record<string, number> = {}
    statusCounts.forEach((s: any) => { statusMap[s._id] = s.count })

    const kpis = {
      totalCalls,
      resolvedCount:  statusMap['resolved']  || 0,
      escalatedCount: statusMap['escalated'] || 0,
      missedCount:    statusMap['missed']    || 0,
      liveCount:      statusMap['live']      || 0,
      redFlagCount,
      avgDurationSeconds: Math.round(durationResult[0]?.avg || 0)
    }

    // ── 2. Call volume — last 30 days (day buckets) ────────────────────────
    const volumeRaw = await Call.aggregate([
      { $match: { timestamp: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            year:  { $year:  '$timestamp' },
            month: { $month: '$timestamp' },
            day:   { $dayOfMonth: '$timestamp' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ])

    // Fill in all 30 days (including zeros)
    const volumeMap: Record<string, number> = {}
    volumeRaw.forEach((d: any) => {
      const date = new Date(d._id.year, d._id.month - 1, d._id.day)
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      volumeMap[label] = d.count
    })

    const callVolume = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      callVolume.push({ date: label, count: volumeMap[label] || 0 })
    }

    // ── 3. Status breakdown (for donut chart) ─────────────────────────────
    const statusBreakdown = statusCounts
      .map((s: any) => ({ name: s._id, value: s.count }))
      .filter((s: any) => s.name) // remove null/undefined statuses

    // ── 4. Intent breakdown ────────────────────────────────────────────────
    const intentRaw = await Call.aggregate([
      { $match: { detected_intent: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: '$detected_intent', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ])
    const intentBreakdown = intentRaw.map((i: any) => ({ intent: i._id, count: i.count }))

    // ── 5. Recent red flag calls ───────────────────────────────────────────
    const recentRedFlags = await Call.find({ is_red_flag: true })
      .select('call_id caller_name phone_number call_summary detected_intent status timestamp')
      .sort({ timestamp: -1 })
      .limit(5)
      .lean()

    res.json({
      success: true,
      data: {
        kpis,
        callVolume,
        statusBreakdown,
        intentBreakdown,
        recentRedFlags
      }
    })
  } catch (error) {
    next(error)
  }
}

// ── Get all credit usage (super_admin only) ───────────────────────────────────
export const getAllCreditUsage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const usage = await CreditUsage.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })

    res.json({ success: true, data: usage })
  } catch (error) {
    next(error)
  }
}

// ── Get user credit balance ───────────────────────────────────────────────────
export const getUserCreditBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const user = await User.findById(req.user._id).select('creditBalance')
    res.json({
      success: true,
      data: { creditBalance: user?.creditBalance || 0 }
    })
  } catch (error) {
    next(error)
  }
}