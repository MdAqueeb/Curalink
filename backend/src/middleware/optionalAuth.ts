import type { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthRequest, AuthPayload } from "../types/index.js";

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    next();
    return;
  }
  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  } catch {
    // Invalid token: proceed as anonymous; do not throw.
  }
  next();
}
