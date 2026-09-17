import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisClient from "../config/redis";

export const authLimiter = rateLimit({
    store: new RedisStore({
        sendCommand: (command: string, ...args: string[]) => redisClient.call(command, ...args) as any,
    }),
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 'error',
        message: 'Too many requests from this IP, please try again 15 min later',
    }
});