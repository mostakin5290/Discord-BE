import { z } from "zod";

export const SignupSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const VerifyOtpSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const ResetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
  otp: z.string().length(6, "OTP must be 6 digits"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  username: z.string().min(3).max(30).optional(),
  bio: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
});

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
