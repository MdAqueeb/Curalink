import type { Request, Response } from "express";
import mongoose from "mongoose";
import { env } from "../config/env.js";

const READY_STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

async function checkOllama(): Promise<"up" | "down"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch(`${env.OLLAMA_URL}/api/tags`, { signal: controller.signal });
    return res.ok ? "up" : "down";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}

export async function getHealth(_req: Request, res: Response): Promise<void> {
  const mongoState = READY_STATES[mongoose.connection.readyState] ?? "unknown";
  const ollamaState = await checkOllama();
  const ok = mongoState === "connected";
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    mongo: mongoState,
    ollama: ollamaState,
    model: env.OLLAMA_MODEL,
    embeddingModel: env.OLLAMA_EMBED_MODEL,
    uptimeSec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
