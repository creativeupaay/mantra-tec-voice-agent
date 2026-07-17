import { Request, Response, NextFunction } from 'express'

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  })
}

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response
): void => {
  console.error(err.stack)
  
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  })
}