import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { sendError } from "../utils/apiResponse.js";
import type { AuthRequest, AuthPayload } from "../types/index.js";

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    sendError(res, "Not authenticated", 401);
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    sendError(res, "Invalid or expired token", 401);
  }
}
