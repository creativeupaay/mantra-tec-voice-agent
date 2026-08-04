import express, { Request, Response } from "express";
import cors from "cors";
import connectDB from "./config/database";
import { apiRouter } from "./routes";
import { errorHandler, notFound } from "./middleware/error.middleware";
import { env, validateEnv } from "./config/env.config";
import { ensureBucketLifecycleRule } from "./services/gcs.service";
import { cleanupExpiredRecordings } from "./services/cleanup.service";

// Validate environment variables on startup
validateEnv();

const app = express();

// Connect to database and run lifecycle / cleanup jobs
connectDB().then(() => {
  // 1. Ensure GCS bucket 30-day deletion rule is set
  ensureBucketLifecycleRule(30);

  // 2. Run initial 30-day recording cleanup
  cleanupExpiredRecordings(30);

  // 3. Schedule daily recording cleanup (every 24 hours)
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    cleanupExpiredRecordings(30);
  }, TWENTY_FOUR_HOURS);
});

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
