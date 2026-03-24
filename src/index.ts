import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config();
import { connectToDb } from "./db";
import { connectToRedis } from "./redis";
import authRoutes from "./router/auth.router";
import userRoutes from "./router/user.router";
import schoolRoutes from "./router/school.router";
import reviewRoutes from "./router/review.router";
import { errorHandler, notFound } from "./middleware/error.middleware";


connectToDb();
connectToRedis();

const port = process.env.PORT || 8080;
const app  = express();

// ── Core middleware ─────────────────────────────────────────────

// 2. Configure CORS
// Option A: Allow everything (Good for initial dev, bad for production)
// app.use(cors()); 

// Option B: Restricted (Recommended)
app.use(cors({
  origin: process.env.FRONTEND_URL || "https://findschool-cnc9.vercel.app", // Your React app URL
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true, // Allow cookies/auth headers if needed
}));

// ── Core middleware ─────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ──────────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: "API is running" });
});

app.use("/api/auth",  authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/schools/:schoolId/reviews",   reviewRoutes); 

// ── Error handling (must be last) ───────────────────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

export default app;