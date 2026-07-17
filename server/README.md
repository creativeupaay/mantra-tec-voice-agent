# Mantra Tech Voice Agent - Backend Server

Express + TypeScript backend API server.

## Features

- JWT Authentication with Access & Refresh Tokens
- Voice Agents CRUD operations
- Session management
- MongoDB integration with Mongoose
- Centralized environment variable management

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No (default: 5000) | Server port |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret key for JWT signing |
| `CLIENT_URL` | Yes | Frontend URL for CORS |

## API Endpoints

### Analytics Routes (`/api/v1/analytics`)
- `GET /analytics` - Get dashboard analytics (admin + super_admin)
- `GET /credit-balance` - Get user credit balance (authenticated)
- `GET /credit-usage` - Get all credit usage records (super_admin only)

### Auth Routes (`/api/v1/auth`)
- `POST /register` - Register new user (returns access & refresh tokens)
- `POST /login` - Login user (returns access & refresh tokens)
- `POST /refresh` - Refresh access token
- `GET /profile` - Get user profile (authenticated)

### Agent Routes (`/api/v1/agents`)
- `GET /` - Get all voice agents (authenticated)
- `GET /:id` - Get agent by ID (authenticated)
- `POST /` - Create agent (authenticated)
- `PUT /:id` - Update agent (authenticated)
- `DELETE /:id` - Delete agent (authenticated)

### Session Routes (`/api/v1/sessions`)
- `GET /` - Get all sessions (authenticated)
- `GET /:id` - Get session by ID (authenticated)
- `POST /` - Create session (authenticated)
- `PATCH /:id/end` - End session (authenticated)

## Project Structure

```
src/
├── config/
│   ├── database.ts    # MongoDB connection
│   └── env.config.ts  # Environment variable management
├── controllers/
│   ├── agent.controller.ts
│   ├── analytics.controller.ts
│   ├── auth.controller.ts
│   └── session.controller.ts
├── middleware/
│   ├── auth.middleware.ts
│   └── error.middleware.ts
├── models/
│   ├── User.ts         # User model with password hashing, token methods & roles
│   ├── CreditUsage.ts   # Credit usage tracking model
│   ├── VoiceAgent.ts
│   └── Session.ts
├── routes/
│   ├── index.ts        # Main router
│   └── v1/
│       ├── analytics.routes.ts
│       ├── agent.routes.ts
│       ├── auth.routes.ts
│       └── session.routes.ts
├── types/
│   └── index.ts        # Express type augmentations
└── index.ts           # Application entry point
```

## Getting Started

```bash
npm install
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server with nodemon
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server