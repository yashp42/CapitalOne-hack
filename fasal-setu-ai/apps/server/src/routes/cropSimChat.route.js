import { Router } from "express";
import { handleCropSimChat } from "../controllers/cropSimChat.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// Secure all routes with authentication
router.use(verifyJWT);

// POST /api/crop-sim/chat - Main chat endpoint
router.post("/chat", handleCropSimChat);

export default router;
