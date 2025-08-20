import { Router } from 'express';
import {
  getUserConversations,
  getConversation,
  createConversation,
  addMessageToConversation,
  updateConversationTitle,
  deleteConversation
} from '../controllers/conversation.controller.js';

const router = Router();

// Get all conversations for the authenticated user
router.get('/conversations', getUserConversations);

// Create a new conversation
router.post('/conversations', createConversation);

// Get a specific conversation
router.get('/conversations/:conversationId', getConversation);

// Add a message to a conversation
router.post('/conversations/:conversationId/messages', addMessageToConversation);

// Update conversation title
router.patch('/conversations/:conversationId/title', updateConversationTitle);

// Delete conversation
router.delete('/conversations/:conversationId', deleteConversation);

export default router;
