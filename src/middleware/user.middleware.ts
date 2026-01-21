import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import client from "../config/db.js";

export interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw new AppError("Not authorized. Please login.", 401);
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };

    const user = await client.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        bannerUrl: true,
        bio: true,
        provider: true,
        password: true,
      },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === "JsonWebTokenError") {
      return next(new AppError("Invalid token", 401));
    }
    if (error.name === "TokenExpiredError") {
      return next(new AppError("Token expired", 401));
    }
    next(error);
  }
};

export const authenticate = protect;
