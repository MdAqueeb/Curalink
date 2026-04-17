import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { sendError } from "../utils/apiResponse.js";
import { env } from "../config/env.js";

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
  }
}

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ZodError) {
    sendError(res, "Validation error", 422, err.flatten().fieldErrors);
    return;
  }

  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
    return;
  }

  if (env.NODE_ENV === "development") {
    console.error(err);
  }

  sendError(res, "Internal server error", 500);
};

export const notFound = (_req: Request, res: Response) => {
  sendError(res, `Route not found`, 404);
};
