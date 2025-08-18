import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
      default: "New Conversation"
    },
    messages: [
      {
        role: {
          type: String,
          enum: ["user", "assistant"],
          required: true
        },
        content: {
          type: String,
          required: true,
          maxlength: 5000
        },
        timestamp: {
          type: Date,
          default: Date.now
        },
        metadata: {
          intent: String,
          requestId: String,
          timings: {
            total_ms: Number,
            llm1_ms: Number,
            decision_ms: Number,
            llm2_ms: Number
          }
        }
      }
    ],
    mode: {
      type: String,
      enum: ["public_advisor", "my_farm"],
      default: "public_advisor"
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient querying
conversationSchema.index({ user: 1, lastMessageAt: -1 });
conversationSchema.index({ user: 1, isActive: 1, lastMessageAt: -1 });

// Pre-save middleware to update lastMessageAt
conversationSchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 0) {
    this.lastMessageAt = this.messages[this.messages.length - 1].timestamp;
  }
  next();
});

// Auto-generate title from first user message
conversationSchema.pre('save', function(next) {
  if (this.isNew && this.messages && this.messages.length > 0) {
    const firstUserMessage = this.messages.find(msg => msg.role === 'user');
    if (firstUserMessage && this.title === 'New Conversation') {
      // Generate title from first 50 characters of first user message
      this.title = firstUserMessage.content.length > 50 
        ? firstUserMessage.content.substring(0, 50) + '...'
        : firstUserMessage.content;
    }
  }
  next();
});

// Virtual for message count
conversationSchema.virtual('messageCount').get(function() {
  return this.messages ? this.messages.length : 0;
});

// Virtual for last message
conversationSchema.virtual('lastMessage').get(function() {
  return this.messages && this.messages.length > 0 
    ? this.messages[this.messages.length - 1] 
    : null;
});

// Ensure virtuals are included in JSON
conversationSchema.set('toJSON', { virtuals: true });

const Conversation = mongoose.model("Conversation", conversationSchema);

export { Conversation };
