import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";

const app = express();
const port = env.PORT;
const frontend_url = env.FRONTEND_BASE_URL;

app.use(
  cors({
    origin: [frontend_url],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

import passport from "./config/passport.js";
app.use(passport.initialize());

import authRoutes from "./routes/auth.routes.js";

app.use("/api/auth", authRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({
    message: "All Good!",
  });
});

app.use(globalErrorHandler);

import client from "./config/db.js";

app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);
  try {
    await client.$connect();
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
});

