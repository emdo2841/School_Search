import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { verifyAccessToken } from "../utils/jwt";
import { isTokenBlacklisted } from "../utils/redis-helpers";

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "No token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      res.status(401).json({ success: false, message: "Token has been revoked" });
      return;
    }

    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

export const authorize = (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }
    next();
  };