import { Router } from 'express';
import { chatFlow, chatHealth } from '../controllers/chat.controller.js';

const router = Router();

// Chat endpoints
router.post('/chat', chatFlow);
router.get('/chat/health', chatHealth);

export default router;
