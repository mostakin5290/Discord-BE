import dotenv from "dotenv";

dotenv.config();

export const env = {
  PORT: process.env.PORT || "3000",
  NODE_ENV: process.env.NODE_ENV || "development",
  FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL || "http://localhost:3000",
  JWT_SECRET: process.env.JWT_SECRET || "secret",
  GOOGLE: {
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  },
  GITHUB: {
    CLIENT_ID: process.env.GITHUB_CLIENT_ID || "",
    CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || "",
  },
  FACEBOOK: {
    APP_ID: process.env.FACEBOOK_APP_ID || "",
    APP_SECRET: process.env.FACEBOOK_APP_SECRET || "",
  },
  DATABASE_URL: process.env.DATABASE_URL || "",
};

