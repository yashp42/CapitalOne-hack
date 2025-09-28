import mongoose from "mongoose";

const answerSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
        trim: true,
        minlength: [10, 'Answer must be at least 10 characters long'],
        maxlength: [500, 'Answer cannot exceed 500 characters']
    },
    
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true
    },
    
    isAccepted: {
        type: Boolean,
        default: false
    },
    
    // Language for multilingual support
    language: {
        type: String,
        default: 'en-IN'
    }
}, {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    versionKey: false
});

// Indexes
answerSchema.index({ post: 1 });
answerSchema.index({ author: 1 });
answerSchema.index({ isAccepted: 1 });
answerSchema.index({ created_at: -1 });

// Static methods
answerSchema.statics.findByPost = function(postId) {
    return this.find({ post: postId })
        .populate('author', 'firstName lastName phoneNumber')
        .sort({ isAccepted: -1, created_at: 1 }); // Accepted answers first, then chronological
};

answerSchema.statics.findByAuthor = function(authorId) {
    return this.find({ author: authorId })
        .populate('post', 'title')
        .sort({ created_at: -1 });
};

// Instance methods
answerSchema.methods.markAsAccepted = function() {
    this.isAccepted = true;
    return this.save();
};

answerSchema.methods.unmarkAsAccepted = function() {
    this.isAccepted = false;
    return this.save();
};

const Answer = mongoose.model('Answer', answerSchema);

export default Answer;