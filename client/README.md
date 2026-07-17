# Mantra Tech Voice Agent - Admin Client

A React + TypeScript + Tailwind CSS admin dashboard for managing voice agents.

## Features

- **Authentication** - JWT-based login/register with token refresh
- **Dashboard** - Statistics overview with quick actions
- **Calls Management** - View call history with recordings, transcripts, and summaries
- **Analytics** - Dashboard analytics (admin + super admin)
- **Usage** - Credit usage tracking for developers (super admin only)
- **Role-Based Access Control** - Admin and Super Admin roles
- **Axios API Client** - Centralized HTTP client with automatic token refresh

## Navigation Tabs

| Tab | Access | Description |
|-----|--------|-------------|
| Dashboard | All authenticated | Overview statistics |
| Calls | All authenticated | Call history with recordings |
| Analytics | All authenticated | Analytics dashboard |
| Settings | All authenticated | Application settings |
| Usage | Super Admin only | Credit usage tracking |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No (default: http://localhost:5000/api) | Backend API URL |
| `VITE_APP_TITLE` | No | Application title |

## Project Structure

```
src/
├── api/
│   └── client.ts        # Axios API client with token refresh
├── components/
│   └── ProtectedRoute.tsx  # Route protection component
├── layouts/
│   └── MainLayout.tsx   # Main admin layout with sidebar
├── pages/
│   ├── AnalyticsPage.tsx   # Analytics dashboard
│   ├── CallsPage.tsx       # Call history with recordings
│   ├── HomePage.tsx        # Main dashboard
│   ├── LoginPage.tsx       # Login page
│   ├── SettingsPage.tsx    # Settings page
│   └── UsagePage.tsx       # Credit usage (super admin)
├── hooks/
│   └── useAuth.ts       # Authentication hook and context
└── types/
    └── api.ts           # API type definitions
```

## Getting Started

```bash
npm install
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## API Integration

The client includes an axios-based API client (`src/api/client.ts`) that:
- Automatically attaches JWT tokens to requests
- Handles 401 errors by attempting token refresh
- Redirects to login on authentication failure
- Supports credential-based authentication for cookies