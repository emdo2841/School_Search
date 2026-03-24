import { Request } from "express";
import { Types } from "mongoose";

export interface AuthPayload {
  userId: string;
  role: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}