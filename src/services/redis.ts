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

// Last Seen Redis Functions
export const updateLastSeenInRedis = async (userId: string, channelId: string, messageId: string) => {
  await redis.hset(`user:lastseen:${userId}`, channelId, messageId);
};

export const getLastSeenFromRedis = async (userId: string): Promise<Record<string, string>> => {
  const data = await redis.hgetall(`user:lastseen:${userId}`);
  return data || {};
};

export const clearLastSeenFromRedis = async (userId: string) => {
  await redis.del(`user:lastseen:${userId}`);
};

export default redis;
