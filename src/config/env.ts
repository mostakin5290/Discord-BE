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
  PINECONE: {
    API_KEY: process.env.PINECONE_API_KEY || "",
    INDEX_NAME: process.env.PINECONE_INDEX_NAME || "",
  },
  CLOUDINARY: {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
    API_KEY: process.env.CLOUDINARY_API_KEY || "",
    API_SECRET: process.env.CLOUDINARY_API_SECRET || "",
  },
  REDIS: {
    HOST: process.env.REDIS_HOST || "localhost",
    PORT: Number(process.env.REDIS_PORT) || 6379,
    USERNAME: process.env.REDIS_USERNAME || "default",
    PASSWORD: process.env.REDIS_PASSWORD || "",
  },
  KAFKA: {
    BROKER: process.env.KAFKA_BROKER || "localhost:9092",
    SSL: process.env.KAFKA_SSL === "true",
    CA_CERT: process.env.KAFKA_CA_CERT || "",
    CLIENT_CERT: process.env.KAFKA_CLIENT_CERT || "",
    CLIENT_KEY: process.env.KAFKA_CLIENT_KEY || "",
  },
  LIVEKIT: {
    API_KEY: process.env.LIVEKIT_API_KEY || "",
    API_SECRET: process.env.LIVEKIT_API_SECRET || "",
    URL: process.env.LIVEKIT_URL || "",
  },
  EMAIL: {
    USER: process.env.EMAIL_USER || "",
    PASS: process.env.EMAIL_PASS || "",
  },
  GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY || "",
};
