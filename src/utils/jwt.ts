import jwt from "jsonwebtoken";
import { AuthPayload, TokenPair } from "../types";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRY = "59m";
const REFRESH_EXPIRY = "7d";

export const generateTokens = (payload: AuthPayload): TokenPair => {
  const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
  const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): AuthPayload => {
  return jwt.verify(token, ACCESS_SECRET) as AuthPayload;
};

export const verifyRefreshToken = (token: string): AuthPayload => {
  return jwt.verify(token, REFRESH_SECRET) as AuthPayload;
};