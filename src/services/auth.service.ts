import client from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

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
      throw new AppError("User with this email or username already exists", 400);
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
}
