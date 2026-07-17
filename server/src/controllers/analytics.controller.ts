import { Request, Response, NextFunction } from 'express'
import { CreditUsage } from '../models/CreditUsage.js'
import { User, UserRole } from '../models/User.js'

// Get dashboard analytics
export const getAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Total users
    const totalUsers = await User.countDocuments()
    
    // Total agents
    const totalAgents = await (await import('../models/VoiceAgent.js')).VoiceAgent.countDocuments()
    
    // Total sessions
    const totalSessions = await (await import('../models/Session.js')).Session.countDocuments()
    
    // Recent credit usage (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentUsage = await CreditUsage.find({
      createdAt: { $gte: thirtyDaysAgo },
      type: 'usage'
    })
    
    const totalCreditsUsed = recentUsage.reduce((sum: number, record: any) => sum + record.amount, 0)
    
    // Monthly usage stats
    const monthlyStats = await CreditUsage.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
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
      data: {
        totalUsers,
        totalAgents,
        totalSessions,
        totalCreditsUsed,
        monthlyStats
      }
    })
  } catch (error) {
    next(error)
  }
}

// Get all credit usage for super admin
export const getAllCreditUsage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const usage = await CreditUsage.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
    
    res.json({
      success: true,
      data: usage
    })
  } catch (error) {
    next(error)
  }
}

// Get user credit balance
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