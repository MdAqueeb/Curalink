import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import routes from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { mountSwagger } from "./docs/swagger.js";

const app = express();

// Security & parsing middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    exposedHeaders: ["X-Session-Id"],
  })
);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Swagger / OpenAPI docs
mountSwagger(app);

// API routes
app.use("/api/v1", routes);

// Root → docs hint
app.get("/", (_req, res) => {
  res.json({
    name: "AI Medical Research Assistant",
    version: "1.0.0",
    docs: "/api-docs",
    health: "/api/v1/health",
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

async function bootstrap() {
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    console.log(`Swagger UI:   http://localhost:${env.PORT}/api-docs`);
    console.log(`OpenAPI JSON: http://localhost:${env.PORT}/api-docs.json`);
  });
}

bootstrap();

export default app;
