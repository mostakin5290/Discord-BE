import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../../services/auth/auth.service.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { env } from "../../config/env.js";
import jwt from "jsonwebtoken";
import { AppError } from "../../utils/AppError.js";
import cloudinary from "../../config/cloudinary.js";
import { uploadToCloudinary } from "../../utils/cloudinary.js";

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
  res.status(201).json(result);
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

// Forgot Password / Reset Password
export const sendOtp = catchAsync(async (req: Request, res: Response) => {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      // not JSON
    }
  }

  const result = await AuthService.sendOtp(body);

  res.status(200).json({
    status: "OTP send successfully",
    ...result,
  });
});

// Verify Otp
export const verifyOtp = catchAsync(async (req: Request, res: Response) => {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      // not JSON
    }
  }

  const result = await AuthService.verifyOtp(body);

  res.status(200).json(result);
});

// Reset Password
export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      // not JSON
    }
  }

  const result = await AuthService.resetPassword(body);

  res.status(200).json({
    message: "Password reset successfully",
    ...result,
  });
});

export const socialCallback = catchAsync(
  async (req: Request, res: Response) => {
    const user = req.user as any;
    if (!user) {
      return res.redirect(`${env.FRONTEND_BASE_URL}/login?error=auth_failed`);
    }

    const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.redirect(`${env.FRONTEND_BASE_URL}/auth/success?token=${token}`);
  },
);

// Get current authenticated user profile
export const getMe = catchAsync(async (req: Request, res: Response) => {
  // req.user is set by the protect middleware
  const user = (req as any).user;

  if (!user) {
    throw new AppError("User not found", 404);
  }

  res.status(200).json({
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      imageUrl: user.imageUrl,
      bannerUrl: user.bannerUrl,
      bio: user.bio,
      provider: user.provider,
      hasPassword: !!user.password,
    },
  });
});

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const { firstName, lastName, username, bio } = req.body;
  // Handle file uploads (Avatar & Banner)
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };


  let imageUrl = user.imageUrl;
  let bannerUrl = user.bannerUrl;

  if (files?.avatar?.[0]) {
    imageUrl = await uploadToCloudinary(files.avatar[0].buffer);
  }

  if (files?.banner?.[0]) {
    bannerUrl = await uploadToCloudinary(files.banner[0].buffer);
  }


  const updatedUser = await AuthService.updateProfile(user.id, {
    firstName,
    lastName,
    username,
    bio,
    imageUrl,
    bannerUrl,
  });

  res.status(200).json({
    message: "Profile updated successfully",
      user: {
      id: updatedUser.id,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      username: updatedUser.username,
      email: updatedUser.email,
      imageUrl: updatedUser.imageUrl,
      bannerUrl: updatedUser.bannerUrl,
      bio: updatedUser.bio,
      provider: updatedUser.provider,
      hasPassword: !!updatedUser.password,
    },
  });
});

export const updatePassword = catchAsync(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
      throw new AppError("User not found", 404);
    }

    await AuthService.updatePassword(user.id, req.body);

    res.status(200).json({
      message: "Password updated successfully",
    });
  },
);

export const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const { password } = req.body;

  await AuthService.deleteAccount(user.id, password);

  res.status(200).json({
    message: "Account deleted successfully",
  });
});

export const disableAccount = catchAsync(
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const { password } = req.body;

    await AuthService.disableAccount(user.id, password);

    res.status(200).json({
      message: "Account disabled successfully",
    });
  },
);
