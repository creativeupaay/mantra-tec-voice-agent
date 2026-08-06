import { Request, Response, NextFunction } from "express";
import { CreditUsage } from "../models/CreditUsage.js";
import { User } from "../models/User.js";
import { Call } from "../models/Call.js";

// ── Get platform overview analytics (super_admin only) ────────────────────────
export const getAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAgents = await (
      await import("../models/VoiceAgent.js")
    ).VoiceAgent.countDocuments();
    const totalSessions = await (
      await import("../models/Session.js")
    ).Session.countDocuments();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUsage = await CreditUsage.find({
      createdAt: { $gte: thirtyDaysAgo },
      type: "usage",
    });

    const totalCreditsUsed = recentUsage.reduce(
      (sum: number, record: any) => sum + record.amount,
      0,
    );

    const monthlyStats = await CreditUsage.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          totalUsed: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalAgents,
        totalSessions,
        totalCreditsUsed,
        monthlyStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Get call performance analytics (admin + super_admin) ──────────────────────
export const getCallAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // ── 1. KPIs ───────────────────────────────────────────────────────────────
    const [totalCalls, statusCounts, durationResult, redFlagCount] =
      await Promise.all([
        Call.countDocuments(),

        Call.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

        Call.aggregate([
          { $match: { duration: { $exists: true, $ne: null } } },
          { $group: { _id: null, avg: { $avg: "$duration" } } },
        ]),

        Call.countDocuments({
          $or: [{ is_red_flag: true }, { is_red_flagged: true }],
        }),
      ]);

    // Map status counts to named fields
    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s: any) => {
      if (s._id) statusMap[s._id] = s.count;
    });

    const kpis = {
      totalCalls,
      resolvedCount: statusMap["resolved"] || 0,
      escalatedCount: statusMap["escalated"] || 0,
      missedCount: statusMap["missed"] || 0,
      liveCount: statusMap["live"] || (totalCalls - (statusMap["resolved"] || 0) - (statusMap["escalated"] || 0) - (statusMap["missed"] || 0)),
      redFlagCount,
      avgDurationSeconds: Math.round(durationResult[0]?.avg || 0),
    };

    // ── 2. Call volume — last 30 days (day buckets) ────────────────────────
    const volumeRaw = await Call.aggregate([
      {
        $addFields: {
          parsedDate: {
            $cond: {
              if: { $eq: [{ $type: "$timestamp" }, "string"] },
              then: { $dateFromString: { dateString: "$timestamp", onError: "$createdAt" } },
              else: { $ifNull: ["$timestamp", "$createdAt"] },
            },
          },
        },
      },
      { $match: { parsedDate: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$parsedDate" },
            month: { $month: "$parsedDate" },
            day: { $dayOfMonth: "$parsedDate" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Fill in all 30 days (including zeros)
    const volumeMap: Record<string, number> = {};
    volumeRaw.forEach((d: any) => {
      const date = new Date(d._id.year, d._id.month - 1, d._id.day);
      const label = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      volumeMap[label] = d.count;
    });

    const callVolume = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      callVolume.push({ date: label, count: volumeMap[label] || 0 });
    }

    // ── 3. Status breakdown (for donut chart) ─────────────────────────────
    const statusBreakdown = statusCounts
      .map((s: any) => ({ name: s._id || 'live', value: s.count }))
      .filter((s: any) => s.name);

    // ── 4. Intent breakdown ────────────────────────────────────────────────
    const allCallsWithIntent = await Call.find({
      $or: [
        { detected_intent: { $exists: true, $nin: [null, ''] } },
        { call_category: { $exists: true, $nin: [null, ''] } },
      ]
    } as any).select('detected_intent call_category').lean()

    const normalizeIntent = (raw?: string, category?: string): string => {
      if (category && category !== 'inquiry') {
        return category.charAt(0).toUpperCase() + category.slice(1)
      }
      if (!raw || raw.toLowerCase() === 'unknown') return 'General Query'
      const lower = raw.toLowerCase()
      if (lower.includes('sale') || lower.includes('buy') || lower.includes('pricing') || lower.includes('purchase')) return 'Sales'
      if (lower.includes('support') || lower.includes('help') || lower.includes('issue') || lower.includes('bug')) return 'Support'
      if (lower.includes('book') || lower.includes('demo') || lower.includes('consultation')) return 'Booking'
      if (lower.includes('complaint') || lower.includes('complain')) return 'Complaint'
      if (lower.includes('tech')) return 'Technical'
      if (lower.includes('bill')) return 'Billing'
      if (lower.includes('inquir') || lower.includes('query')) return 'Product Inquiry'

      const clean = raw.replace(/_/g, ' ').trim()
      return clean.length > 20 ? clean.slice(0, 17) + '...' : clean.charAt(0).toUpperCase() + clean.slice(1)
    }

    const intentMap: Record<string, number> = {}
    allCallsWithIntent.forEach((c: any) => {
      const intentName = normalizeIntent(c.detected_intent, c.call_category)
      intentMap[intentName] = (intentMap[intentName] || 0) + 1
    })

    const intentBreakdown = Object.entries(intentMap).map(([intent, count]) => ({
      intent,
      count,
    }))

    // ── 5. Recent Red Flags ────────────────────────────────────────────────
    const recentRedFlags = await Call.find({
      $or: [{ is_red_flag: true }, { is_red_flagged: true }],
    }).sort({ createdAt: -1 }).limit(5).lean()

    res.json({
      success: true,
      data: {
        kpis,
        callVolume,
        statusBreakdown,
        intentBreakdown,
        recentRedFlags,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Get credit usage history ──────────────────────────────────────────────────
export const getAllCreditUsage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const isSuperAdmin = (req as any).user?.role === 'super_admin';
    const filter = isSuperAdmin ? {} : { userId: (req as any).user?._id };
    const usages = await CreditUsage.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json({
      success: true,
      data: {
        usages,
        pagination: { total: usages.length, page: 1, pages: 1, limit: 100 },
        summary: { totalAmount: 0, byService: {} }
      }
    });
  } catch (error) {
    next(error);
  }
};

// ── Get user credit balance ───────────────────────────────────────────────────
export const getUserCreditBalance = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await User.findById((req as any).user?.id).lean();
    res.json({
      success: true,
      data: { credit_balance: user?.creditBalance || 100 }
    });
  } catch (error) {
    next(error);
  }
};
