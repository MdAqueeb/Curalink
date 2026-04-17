import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

export const researchRateLimiter = rateLimit({
  windowMs: 60_000,
  max: env.RATE_LIMIT_PER_MIN,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many research requests. Please slow down and try again in a minute.",
  },
});
