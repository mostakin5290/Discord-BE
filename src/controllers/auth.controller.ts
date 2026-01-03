import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service.js";
import { catchAsync } from "../utils/catchAsync.js";
import { env } from "../config/env.js";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError.js";

export const signup = catchAsync(async (req: Request, res: Response) => {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      // not JSON, leave as is
    }
  }

  const result = await AuthService.signup(body);
  res.status(201).json({
    message: "User created successfully",
    ...result,
  });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      // not JSON
    }
  }

  const result = await AuthService.login(body);
  res.status(200).json({
    message: "Login successful",
    ...result,
  });
});

export const socialCallback = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  if (!user) {
    return res.redirect(`${env.FRONTEND_BASE_URL}/login?error=auth_failed`);
  }

  const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.redirect(`${env.FRONTEND_BASE_URL}/auth/success?token=${token}`);
});

