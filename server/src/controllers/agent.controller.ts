import { Request, Response, NextFunction } from 'express'
import { VoiceAgent } from '../models/VoiceAgent.js'

export const getAllAgents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const agents = await VoiceAgent.find({ userId: req.user._id })
    res.json({ success: true, data: agents })
  } catch (error) {
    next(error)
  }
}

export const getAgentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const agent = await VoiceAgent.findOne({ _id: req.params.id, userId: req.user._id })
    if (!agent) {
      res.status(404).json({ success: false, message: 'Agent not found' })
      return
    }

    res.json({ success: true, data: agent })
  } catch (error) {
    next(error)
  }
}

export const createAgent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const { name, description } = req.body
    const agent = await VoiceAgent.create({ name, description, userId: req.user._id })

    res.status(201).json({ success: true, data: agent })
  } catch (error) {
    next(error)
  }
}

export const updateAgent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const agent = await VoiceAgent.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    )

    if (!agent) {
      res.status(404).json({ success: false, message: 'Agent not found' })
      return
    }

    res.json({ success: true, data: agent })
  } catch (error) {
    next(error)
  }
}

export const deleteAgent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' })
      return
    }

    const agent = await VoiceAgent.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
    if (!agent) {
      res.status(404).json({ success: false, message: 'Agent not found' })
      return
    }

    res.json({ success: true, message: 'Agent deleted' })
  } catch (error) {
    next(error)
  }
}