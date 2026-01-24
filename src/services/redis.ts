import { Redis } from "ioredis";
import { env } from "../config/env.js";

const redisConfig = {
  host: env.REDIS.HOST,
  port: env.REDIS.PORT,
  username: env.REDIS.USERNAME,
  password: env.REDIS.PASSWORD,
};

const redis = new Redis(redisConfig);
const pub = new Redis(redisConfig);
const sub = new Redis(redisConfig);

redis.on("error", (err) => console.error("Redis Client Error:", err));
pub.on("error", (err) => console.error("Redis Pub Error:", err));
sub.on("error", (err) => console.error("Redis Sub Error:", err));

export const checkUserOnline = async (userId: string): Promise<boolean> => {
  const status = await redis.get(`user:online:${userId}`);
  return !!status;
};

export const setUserOnline = async (userId: string, serverId: string) => {
  await redis.set(`user:online:${userId}`, serverId);
};

export const setUserOffline = async (userId: string) => {
  await redis.del(`user:online:${userId}`);
};

export const publishEvent = async (channel: string, message: any) => {
  await pub.publish(channel, JSON.stringify(message));
};

export const subscribeToEvent = (
  channel: string,
  callback: (message: any) => void,
) => {
  sub.subscribe(channel);
  sub.on("message", (chn: string, msg: string) => {
    if (chn === channel) {
      callback(JSON.parse(msg));
    }
  });
};

export default redis;
