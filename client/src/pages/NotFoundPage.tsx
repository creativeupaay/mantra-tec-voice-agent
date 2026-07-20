import { FC } from 'react'
import { Link } from 'react-router-dom'

const NotFoundPage: FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-6xl font-semibold text-text-primary font-mono tabular-nums mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-text-primary mb-4">
        Page Not Found
      </h2>
      <p className="text-[14px] text-text-secondary mb-8">
        The page you're looking for doesn't exist.
      </p>
      <Link to="/" className="px-5 py-2.5 bg-text-primary text-surface-card rounded-lg hover:bg-black text-[13px] font-medium transition-colors">
        Go Back Home
      </Link>
    </div>
  )
}

export default NotFoundPage