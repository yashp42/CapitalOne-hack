import mongoose from "mongoose";

// Predefined agriculture-related tags
const PREDEFINED_TAGS = [
    'irrigation',
    'pest-control', 
    'fertilizer',
    'seeds',
    'soil-health',
    'weather',
    'harvest',
    'crop-disease',
    'equipment',
    'organic-farming'
];

const postSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: [10, 'Title must be at least 10 characters long'],
        maxlength: [100, 'Title cannot exceed 100 characters']
    },
    
    description: {
        type: String,
        required: true,
        trim: true,
        minlength: [20, 'Description must be at least 20 characters long'],
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    tags: [{
        type: String,
        enum: PREDEFINED_TAGS,
        required: true
    }],
    
    status: {
        type: String,
        enum: ['open', 'solved'],
        default: 'open'
    },
    
    viewCount: {
        type: Number,
        default: 0
    },
    
    solvedAnswerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Answer',
        default: null
    },
    
    // Language for multilingual support
    language: {
        type: String,
        default: 'english'
    }
}, {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    versionKey: false
});

// Indexes for efficient querying
postSchema.index({ author: 1 });
postSchema.index({ tags: 1 });
postSchema.index({ status: 1 });
postSchema.index({ created_at: -1 });
postSchema.index({ title: 'text', description: 'text' }, { default_language: 'english' });

// Static methods
postSchema.statics.findByTags = function(tags, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const query = tags && tags.length > 0 ? { tags: { $in: tags } } : {};
    
    return this.find(query)
        .populate('author', 'firstName lastName phoneNumber')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit);
};

postSchema.statics.findByStatus = function(status, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    return this.find({ status })
        .populate('author', 'firstName lastName phoneNumber')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit);
};

postSchema.statics.searchPosts = function(searchTerm, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    return this.find({ $text: { $search: searchTerm } })
        .populate('author', 'firstName lastName phoneNumber')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit);
};

// Instance methods
postSchema.methods.markAsSolved = function(answerId) {
    this.status = 'solved';
    this.solvedAnswerId = answerId;
    return this.save();
};

postSchema.methods.incrementViewCount = function() {
    this.viewCount += 1;
    return this.save();
};

// Virtual for answer count (will be populated in aggregation)
postSchema.virtual('answerCount', {
    ref: 'Answer',
    localField: '_id',
    foreignField: 'post',
    count: true
});

// Ensure virtual fields are serialized
postSchema.set('toJSON', { virtuals: true });

const Post = mongoose.model('Post', postSchema);

export default Post;
export { PREDEFINED_TAGS };