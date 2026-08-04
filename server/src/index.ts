import express, { Request, Response } from "express";
import cors from "cors";
import connectDB from "./config/database";
import { apiRouter } from "./routes";
import { errorHandler, notFound } from "./middleware/error.middleware";
import { env, validateEnv } from "./config/env.config";

// Validate environment variables on startup
validateEnv();

const app = express();

// Connect to database
connectDB();

const allowedOrigins = env.CLIENT_URL.split(',').map(url => url.trim().replace(/\/$/, ""));

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/v1", apiRouter);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
if (require.main === module) {
  app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
  });
}

export default app;
