import { ReactNode } from 'react'

interface CardProps {
  title?: string
  children: ReactNode
  className?: string
}

export const Card = ({ title, children, className = '' }: CardProps) => {
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      {title && <h3 className="text-lg font-semibold text-gray-800 mb-3">{title}</h3>}
      {children}
    </div>
  )
}