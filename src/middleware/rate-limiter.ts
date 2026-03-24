import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redisClient } from "../redis"; 

// We define the limiter variable but don't assign it yet
let limiter: any;

export const apiLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (!limiter) {
    // Only create the instance when the first request arrives
    limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: "Too many requests, please try again after 15 minutes.",
      },
      store: new RedisStore({
        
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      }),
    });
  }

  return limiter(req, res, next);
};