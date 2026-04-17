import { Router } from "express";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { researchRateLimiter } from "../middleware/rateLimiter.js";
import {
  getSession,
  postFollowup,
  postResearch,
  removeSession,
} from "../controllers/researchController.js";

const router = Router();

router.post("/research", researchRateLimiter, optionalAuth, postResearch);
router.post("/followup", researchRateLimiter, optionalAuth, postFollowup);
router.get("/session/:id", optionalAuth, getSession);
router.delete("/session/:id", optionalAuth, removeSession);

export default router;
