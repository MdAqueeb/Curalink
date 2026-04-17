import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../models/User.js";
import { env } from "../config/env.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import type { AuthRequest } from "../types/index.js";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function generateToken(id: string, email: string): string {
  return jwt.sign({ id, email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

function setTokenCookie(res: Response, token: string): void {
  res.cookie("token", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  const body = registerSchema.parse(req.body);

  const existing = await User.findOne({ email: body.email });
  if (existing) {
    sendError(res, "Email already registered", 409);
    return;
  }

  const user = await User.create(body);
  const token = generateToken(String(user._id), user.email);
  setTokenCookie(res, token);

  sendSuccess(
    res,
    { token, user: { id: user._id, name: user.name, email: user.email } },
    "Registration successful",
    201
  );
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = loginSchema.parse(req.body);

  const user = await User.findOne({ email: body.email }).select("+password");
  if (!user || !(await user.comparePassword(body.password))) {
    sendError(res, "Invalid email or password", 401);
    return;
  }

  const token = generateToken(String(user._id), user.email);
  setTokenCookie(res, token);

  sendSuccess(res, {
    token,
    user: { id: user._id, name: user.name, email: user.email },
  });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie("token");
  sendSuccess(res, null, "Logged out successfully");
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  const user = await User.findById(req.user?.id);
  if (!user) {
    sendError(res, "User not found", 404);
    return;
  }
  sendSuccess(res, { id: user._id, name: user.name, email: user.email });
}
