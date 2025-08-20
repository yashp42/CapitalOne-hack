import { ApiResponse } from "../util/ApiResponse.js";
import { ApiError } from "../util/ApiError.js";
import asyncErrorHandler from "../util/asyncErrorHandler.js";
import { Conversation } from "../models/conversation.model.js";
import jwt from "jsonwebtoken";

// Get user ID from token (helper function)
const getUserIdFromToken = (req) => {
  const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    throw new ApiError(401, "Access token is required");
  }
  
  try {
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    return decodedToken._id;
  } catch (error) {
    throw new ApiError(401, "Invalid access token");
  }
};

// Get all conversations for a user
export const getUserConversations = asyncErrorHandler(async (req, res) => {
  const userId = getUserIdFromToken(req);
  
  const conversations = await Conversation.find({
    user: userId,
    isActive: true
  })
  .select('title lastMessageAt messageCount mode')
  .sort({ lastMessageAt: -1 })
  .limit(50); // Limit to 50 most recent conversations

  res.status(200).json(
    new ApiResponse(200, conversations, "Conversations retrieved successfully")
  );
});

// Get a specific conversation with messages
export const getConversation = asyncErrorHandler(async (req, res) => {
  const userId = getUserIdFromToken(req);
  const { conversationId } = req.params;

  const conversation = await Conversation.findOne({
    _id: conversationId,
    user: userId,
    isActive: true
  });

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  res.status(200).json(
    new ApiResponse(200, conversation, "Conversation retrieved successfully")
  );
});

// Create a new conversation
export const createConversation = asyncErrorHandler(async (req, res) => {
  const userId = getUserIdFromToken(req);
  const { title, mode = "public_advisor" } = req.body;

  const conversation = await Conversation.create({
    user: userId,
    title: title || "New Conversation",
    mode,
    messages: []
  });

  res.status(201).json(
    new ApiResponse(201, conversation, "Conversation created successfully")
  );
});

// Add message to conversation
export const addMessageToConversation = asyncErrorHandler(async (req, res) => {
  const userId = getUserIdFromToken(req);
  const { conversationId } = req.params;
  const { role, content, metadata } = req.body;

  if (!role || !content) {
    throw new ApiError(400, "Role and content are required");
  }

  if (!["user", "assistant"].includes(role)) {
    throw new ApiError(400, "Role must be 'user' or 'assistant'");
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    user: userId,
    isActive: true
  });

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  // Add the message
  const newMessage = {
    role,
    content,
    timestamp: new Date(),
    metadata: metadata || {}
  };

  conversation.messages.push(newMessage);
  await conversation.save();

  res.status(200).json(
    new ApiResponse(200, newMessage, "Message added successfully")
  );
});

// Update conversation title
export const updateConversationTitle = asyncErrorHandler(async (req, res) => {
  const userId = getUserIdFromToken(req);
  const { conversationId } = req.params;
  const { title } = req.body;

  if (!title || title.trim().length === 0) {
    throw new ApiError(400, "Title is required");
  }

  const conversation = await Conversation.findOneAndUpdate(
    {
      _id: conversationId,
      user: userId,
      isActive: true
    },
    { title: title.trim() },
    { new: true }
  );

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  res.status(200).json(
    new ApiResponse(200, conversation, "Conversation title updated successfully")
  );
});

// Delete conversation (soft delete)
export const deleteConversation = asyncErrorHandler(async (req, res) => {
  const userId = getUserIdFromToken(req);
  const { conversationId } = req.params;

  const conversation = await Conversation.findOneAndUpdate(
    {
      _id: conversationId,
      user: userId,
      isActive: true
    },
    { isActive: false },
    { new: true }
  );

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  res.status(200).json(
    new ApiResponse(200, null, "Conversation deleted successfully")
  );
});

// Save entire conversation (helper for chat endpoint)
export const saveConversation = async (userId, messages, mode = "public_advisor", existingConversationId = null) => {
  try {
    if (existingConversationId) {
      // Update existing conversation
      const conversation = await Conversation.findOne({
        _id: existingConversationId,
        user: userId,
        isActive: true
      });

      if (conversation) {
        // Add new messages (assuming the last ones are new)
        const existingMessageCount = conversation.messages.length;
        const newMessages = messages.slice(existingMessageCount);
        
        // Transform new messages to match schema requirements
        const transformedNewMessages = newMessages.map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant', // Convert 'bot' to 'assistant'
          content: msg.content,
          timestamp: msg.timestamp || new Date(),
          metadata: msg.metadata || {}
        }));
        
        conversation.messages.push(...transformedNewMessages);
        await conversation.save();
        return conversation;
      }
    }

    // Create new conversation
    const conversationMessages = messages.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant', // Convert 'bot' to 'assistant'
      content: msg.content,
      timestamp: msg.timestamp || new Date(),
      metadata: msg.metadata || {}
    }));

    const conversation = await Conversation.create({
      user: userId,
      messages: conversationMessages,
      mode
    });

    return conversation;
  } catch (error) {
    console.error('Error saving conversation:', error);
    return null;
  }
};
