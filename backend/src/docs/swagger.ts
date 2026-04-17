import type { Express, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./openapi.js";

export function mountSwagger(app: Express): void {
  app.get("/api-docs.json", (_req: Request, res: Response) => {
    res.json(openApiDocument);
  });
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "Medical Research Assistant API",
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
    })
  );
}
