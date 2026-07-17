import { FC } from 'react'
import { Link } from 'react-router-dom'

const NotFoundPage: FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-6xl font-bold text-slate-800 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-slate-700 mb-4">
        Page Not Found
      </h2>
      <p className="text-slate-600 mb-8">
        The page you're looking for doesn't exist.
      </p>
      <Link to="/" className="px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 text-sm">
        Go Back Home
      </Link>
    </div>
  )
}

export default NotFoundPage