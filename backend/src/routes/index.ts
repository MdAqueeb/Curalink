import { Router } from "express";
import authRoutes from "./authRoutes.js";
import researchRoutes from "./researchRoutes.js";
import { getHealth } from "../controllers/healthController.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/", researchRoutes);
router.get("/health", getHealth);

export default router;
