import type { Response } from "express";
import type { ApiResponse } from "../types/index.js";

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode = 200
): Response {
  const response: ApiResponse<T> = { success: true, message, data };
  return res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: unknown
): Response {
  const response: ApiResponse = { success: false, message, errors };
  return res.status(statusCode).json(response);
}
