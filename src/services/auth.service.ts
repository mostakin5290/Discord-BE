import client from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

import { sendOtpMail } from "../utils/mailer.js";
import { success } from "zod/v4";

export class AuthService {
  static async signup(data: any) {
    const { firstName, lastName, username, email, password } = data;

    if (!firstName || !lastName || !username || !email || !password) {
      throw new AppError("All fields are required", 400);
    }

    const existingUser = await client.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw new AppError(
        "User with this email or username already exists",
        400,
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await client.user.create({
      data: {
        firstName,
        lastName,
        username,
        email,
        password: hashedPassword,
      },
    });

    const token = jwt.sign({ userId: newUser.id }, env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return {
      user: {
        id: newUser.id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        username: newUser.username,
        email: newUser.email,
      },
      token,
    };
  }

  static async login(data: any) {
    const { email, password } = data;

    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }

    const user = await client.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      throw new AppError("Invalid credentials", 400);
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new AppError("Invalid credentials", 400);
    }

    const token = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        imageUrl: user.imageUrl,
        bannerUrl: user.bannerUrl,
        bio: user.bio,
      },
      token,
    };
  }

  static async findOrCreateSocialUser(profile: any, provider: string) {
    const email = profile.email; // Extracted by passport strategy
    if (!email) {
      throw new Error(`No email found from ${provider}`);
    }

    let user = await client.user.findFirst({
      where: {
        OR: [{ email }, { socialId: profile.id, provider }],
      },
    });

    if (!user) {
      user = await client.user.create({
        data: {
          email,
          username:
            profile.username ||
            email.split("@")[0]! + Math.floor(Math.random() * 1000),
          firstName: profile.firstName || "User",
          lastName: profile.lastName || "",
          socialId: profile.id,
          provider,
          imageUrl: profile.imageUrl || null,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
        },
      });
    } else if (!user.socialId) {
      // Link existing account
      user = await client.user.update({
        where: { id: user.id },
        data: {
          socialId: profile.id,
          provider,
          imageUrl: profile.imageUrl || user.imageUrl,
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
        },
      });
    }

    return user;
  }

  // Forgot password - Send OTP
  static async sendOtp(data: any) {
    const { email } = data;

    if (!email) {
      throw new AppError("Email is required", 400);
    }

    const user = await client.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      throw new AppError("Invalid credentials", 400);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await client.user.update({
      where: { email },
      data: {
        resetOtp: otp,
        isOtpVerified: false,
        otpExpires: new Date(Date.now() + 5 * 60 * 1000), // 5 mins
      },
    });

    // Send the mail by nodemailer
    try {
      await sendOtpMail({ to: email, otp });

      return {
        message: "OTP sent successfully",
      };
    } catch (error) {
      console.error("OTP process failed:", error);

      // Rollback OTP if mail fails
      await client.user.update({
        where: { email },
        data: {
          resetOtp: null,
          otpExpires: null,
        },
      });

      throw new AppError("Unable to send OTP. Please try again later.", 500);
    }
  }

  // Verify the OTP
  static async verifyOtp(data: any) {
    const { email, otp } = data;
    if (!email || !otp) {
      throw new AppError("Email and OTP are required", 400);
    }

    const user = await client.user.findUnique({
      where: { email },
    });

    if (!user || !user.resetOtp) {
      throw new AppError("Invalid credentials", 400);
    }

    if (user.resetOtp !== otp.toString()) {
      throw new AppError("Invalid OTP", 400);
    }

    if (!user.otpExpires || user.otpExpires < new Date()) {
      throw new AppError("OTP expired", 400);
    }

    // OTP verified, now clear it
    await client.user.update({
      where: { id: user.id },
      data: {
        resetOtp: null,
        isOtpVerified: true,
        otpExpires: null,
      },
    });

    return {
      success: "True",
    };
  }

  // Reset The Password
  static async resetPassword(data: any) {
    const { email, newPassword } = data;
    if (!email || !newPassword) {
      throw new AppError("Email and newPassword are required", 400);
    }

    const user = await client.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError("Invalid credentials", 400);
    }

    if (!user.isOtpVerified) {
      throw new AppError(
        "Please verify your OTP before resetting password.",
        400,
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await client.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isOtpVerified: false, // Reset verification flag
      },
    });

    return {
      success: "True",
    };
  }

  static async updateProfile(userId: string, data: any) {
    const { firstName, lastName, username, bio, imageUrl, bannerUrl } = data;

    // Check if username is taken (if being updated)
    if (username) {
      const existingUser = await client.user.findFirst({
        where: {
          username,
          id: { not: userId },
        },
      });

      if (existingUser) {
        throw new AppError("Username already taken", 400);
      }
    }

    const updatedUser = await client.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        username,
        bio,
        imageUrl,
        bannerUrl,
      },
    });

    return updatedUser;
  }

  static async updatePassword(userId: string, data: any) {
    const { currentPassword, newPassword } = data;

    if (!currentPassword || !newPassword) {
      throw new AppError("Current and new passwords are required", 400);
    }

    const user = await client.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new AppError("User not found or social login user", 404);
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      throw new AppError("Invalid current password", 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await client.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

    return { message: "Password updated successfully" };
  }

  static async deleteAccount(userId: string, password?: string) {
    const user = await client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // If user has password (not social login), verify it
    if (user.password) {
      if (!password) {
        throw new AppError("Password is required", 400);
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new AppError("Invalid password", 400);
      }
    }

    // Delete user (cascade will handle related data)
    await client.user.delete({
      where: { id: userId },
    });

    return { message: "Account deleted successfully" };
  }

  static async disableAccount(userId: string, password?: string) {
    const user = await client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    // If user has password (not social login), verify it
    if (user.password) {
      if (!password) {
        throw new AppError("Password is required", 400);
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new AppError("Invalid password", 400);
      }
    }

    // For now, we'll use a soft delete by updating email with a disabled flag
    // You might want to add an isDisabled field to your schema
    await client.user.update({
      where: { id: userId },
      data: {
        email: `disabled_${user.id}@disabled.com`,
      },
    });

    return { message: "Account disabled successfully" };
  }
}
