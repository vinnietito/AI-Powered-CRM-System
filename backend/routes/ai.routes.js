import { Router } from "express";
import {
    aiStatus,
    leadSumarry,
    generateEmailDraft,
    salesInsights,
} from "../controllers/ai.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();
router.use(protect);

router.get("/status", aiStatus);
router.post("/lead-summary", leadSumarry);
router.post("/generate-email", generateEmailDraft);
router.post("/sales-insights", salesInsights);

export default router;