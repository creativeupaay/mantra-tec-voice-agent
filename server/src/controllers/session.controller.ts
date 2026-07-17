import { Request, Response, NextFunction } from 'express'
import { Session } from '../models/Session.js'

export const getAllSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const sessions = await Session.find({ userId: req.user._id }).sort({ createdAt: -1 })
    res.json({ success: true, data: sessions })
  } catch (error) {
    next(error)
  }
}

export const getSessionById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const session = await Session.findOne({ _id: req.params.id, userId: req.user._id })
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' })
      return
    }

    res.json({ success: true, data: session })
  } catch (error) {
    next(error)
  }
}

export const createSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const { agentId } = req.body
    const session = await Session.create({
      agentId,
      userId: req.user._id,
      startTime: new Date(),
      status: 'active',
    })

    res.status(201).json({ success: true, data: session })
  } catch (error) {
    next(error)
  }
}

export const endSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const session = await Session.findOne({ _id: req.params.id, userId: req.user._id })
    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' })
      return
    }

    session.endTime = new Date()
    session.duration = Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000)
    session.status = 'completed'

    await session.save()
    res.json({ success: true, data: session })
  } catch (error) {
    next(error)
  }
}