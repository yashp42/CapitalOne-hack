import Post, { PREDEFINED_TAGS } from '../models/post.model.js';
import Answer from '../models/answer.model.js';
import { ApiResponse } from '../util/ApiResponse.js';
import { ApiError } from '../util/ApiError.js';

// Agriculture-related keywords for content validation
const AGRICULTURE_KEYWORDS = [
    'crop', 'farming', 'farm', 'plant', 'seed', 'soil', 'water', 'irrigation',
    'fertilizer', 'pest', 'disease', 'harvest', 'weather', 'agriculture',
    'organic', 'pesticide', 'equipment', 'tractor', 'field', 'cultivation',
    'yield', 'rice', 'wheat', 'corn', 'sugarcane', 'cotton', 'vegetable',
    'fruit', 'dairy', 'livestock', 'cattle', 'poultry', 'भ्रष्टाचार', 'खेती',
    'फसल', 'किसान', 'कृषि', 'सिंचाई', 'उर्वरक'
];

// Content validation helper
const validateAgricultureContent = (title, description) => {
    const content = `${title} ${description}`.toLowerCase();
    return AGRICULTURE_KEYWORDS.some(keyword => content.includes(keyword.toLowerCase()));
};

// Get all posts with filtering, pagination
export const getPosts = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            tags, 
            status, 
            search 
        } = req.query;

        const skip = (page - 1) * limit;
        let query = {};

        // Apply filters
        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim());
            query.tags = { $in: tagArray };
        }

        if (status && status !== 'all') {
            query.status = status;
        }

        if (search) {
            query.$text = { $search: search };
        }

        // Get posts with aggregation for answer count
        const posts = await Post.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'answers',
                    localField: '_id',
                    foreignField: 'post',
                    as: 'answers'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'author',
                    foreignField: '_id',
                    as: 'authorInfo'
                }
            },
            {
                $addFields: {
                    answerCount: { $size: '$answers' },
                    author: { 
                        $arrayElemAt: [
                            {
                                $map: {
                                    input: '$authorInfo',
                                    as: 'author',
                                    in: {
                                        _id: '$$author._id',
                                        firstName: '$$author.firstName',
                                        lastName: '$$author.lastName',
                                        phoneNumber: '$$author.phoneNumber'
                                    }
                                }
                            }, 0
                        ]
                    }
                }
            },
            {
                $project: {
                    answers: 0,
                    authorInfo: 0
                }
            },
            { $sort: { created_at: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) }
        ]);

        // Get total count for pagination
        const totalPosts = await Post.countDocuments(query);
        const totalPages = Math.ceil(totalPosts / limit);

        res.status(200).json(
            new ApiResponse(200, {
                posts,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalPosts,
                    hasMore: page < totalPages,
                    limit: parseInt(limit)
                }
            }, "Posts fetched successfully")
        );
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json(
            new ApiError(500, "Failed to fetch posts")
        );
    }
};

// Get single post with answers
export const getPost = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Fetching post with ID:', id);

        // Validate ObjectId format
        if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
            console.log('Invalid ObjectId format:', id);
            return res.status(400).json(
                new ApiError(400, "Invalid post ID format")
            );
        }

        const post = await Post.findById(id)
            .populate('author', 'firstName lastName phoneNumber');

        console.log('Post found:', !!post);

        if (!post) {
            return res.status(404).json(
                new ApiError(404, "Post not found")
            );
        }

        // Increment view count
        console.log('Incrementing view count');
        await post.incrementViewCount();

        // Get answers for this post
        console.log('Fetching answers for post');
        const answers = await Answer.findByPost(id);
        console.log('Answers found:', answers.length);

        res.status(200).json(
            new ApiResponse(200, { post, answers }, "Post fetched successfully")
        );
    } catch (error) {
        console.error('Error fetching post:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json(
            new ApiError(500, `Failed to fetch post: ${error.message}`)
        );
    }
};

// Create new post
export const createPost = async (req, res) => {
    try {
        const { title, description, tags } = req.body;
        const userId = req.user._id;

        // Validation
        if (!title || !description || !tags || !Array.isArray(tags)) {
            return res.status(400).json(
                new ApiError(400, "Title, description, and tags are required")
            );
        }

        // Check title and description length
        if (title.length < 10 || title.length > 100) {
            return res.status(400).json(
                new ApiError(400, "Title must be between 10 and 100 characters")
            );
        }

        if (description.length < 20 || description.length > 1000) {
            return res.status(400).json(
                new ApiError(400, "Description must be between 20 and 1000 characters")
            );
        }

        // Validate tags
        if (tags.length === 0 || tags.length > 3) {
            return res.status(400).json(
                new ApiError(400, "Please select 1-3 tags")
            );
        }

        const invalidTags = tags.filter(tag => !PREDEFINED_TAGS.includes(tag));
        if (invalidTags.length > 0) {
            return res.status(400).json(
                new ApiError(400, `Invalid tags: ${invalidTags.join(', ')}`)
            );
        }

        // Agriculture content validation
        if (!validateAgricultureContent(title, description)) {
            return res.status(400).json(
                new ApiError(400, "Content must be related to agriculture or farming")
            );
        }

        const post = new Post({
            title: title.trim(),
            description: description.trim(),
            tags,
            author: userId,
            language: 'english'  // Use MongoDB supported language for text search
        });

        await post.save();
        await post.populate('author', 'firstName lastName phoneNumber');

        res.status(201).json(
            new ApiResponse(201, post, "Post created successfully")
        );
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json(
            new ApiError(500, "Failed to create post")
        );
    }
};

// Mark post as solved
export const markPostAsSolved = async (req, res) => {
    try {
        const { id, answerId } = req.params;
        const userId = req.user._id;

        const post = await Post.findById(id);
        if (!post) {
            return res.status(404).json(
                new ApiError(404, "Post not found")
            );
        }

        // Check if user is the author of the post
        if (post.author.toString() !== userId.toString()) {
            return res.status(403).json(
                new ApiError(403, "Only the post author can mark answers as solved")
            );
        }

        const answer = await Answer.findById(answerId);
        if (!answer || answer.post.toString() !== id) {
            return res.status(404).json(
                new ApiError(404, "Answer not found")
            );
        }

        // Unmark previous accepted answer if exists
        if (post.solvedAnswerId) {
            const previousAnswer = await Answer.findById(post.solvedAnswerId);
            if (previousAnswer) {
                await previousAnswer.unmarkAsAccepted();
            }
        }

        // Mark new answer as accepted
        await answer.markAsAccepted();
        await post.markAsSolved(answerId);

        res.status(200).json(
            new ApiResponse(200, { post, answer }, "Post marked as solved")
        );
    } catch (error) {
        console.error('Error marking post as solved:', error);
        res.status(500).json(
            new ApiError(500, "Failed to mark post as solved")
        );
    }
};

// Mark post as solved without specific answer
export const markPostSolved = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const post = await Post.findById(id);
        if (!post) {
            return res.status(404).json(
                new ApiError(404, "Post not found")
            );
        }

        // Check if user is the author of the post
        if (post.author.toString() !== userId.toString()) {
            return res.status(403).json(
                new ApiError(403, "Only the post author can mark post as solved")
            );
        }

        // Simply update the status to solved
        post.status = 'solved';
        await post.save();

        res.status(200).json(
            new ApiResponse(200, { post }, "Post marked as solved")
        );
    } catch (error) {
        console.error('Error marking post as solved:', error);
        res.status(500).json(
            new ApiError(500, "Failed to mark post as solved")
        );
    }
};

// Get all available tags
export const getTags = async (req, res) => {
    try {
        res.status(200).json(
            new ApiResponse(200, { tags: PREDEFINED_TAGS }, "Tags fetched successfully")
        );
    } catch (error) {
        res.status(500).json(
            new ApiError(500, "Failed to fetch tags")
        );
    }
};

// Get user's posts
export const getMyPosts = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const userId = req.user._id;
        
        const skip = (page - 1) * limit;
        
        // Build match query
        let matchQuery = { author: userId };
        if (status && status !== 'all') {
            matchQuery.status = status;
        }
        
        const posts = await Post.aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'answers',
                    localField: '_id',
                    foreignField: 'post',
                    as: 'answers'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'author',
                    foreignField: '_id',
                    as: 'author',
                    pipeline: [
                        { $project: { firstName: 1, lastName: 1, phoneNumber: 1 } }
                    ]
                }
            },
            { $unwind: '$author' },
            {
                $addFields: {
                    answerCount: { $size: '$answers' }
                }
            },
            { $project: { answers: 0 } },
            { $sort: { created_at: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) }
        ]);
        
        const totalPosts = await Post.countDocuments(matchQuery);
        const totalPages = Math.ceil(totalPosts / limit);
        
        res.status(200).json(
            new ApiResponse(200, {
                posts,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages,
                    totalPosts
                }
            }, "My posts fetched successfully")
        );
    } catch (error) {
        console.error('Error fetching my posts:', error);
        res.status(500).json(
            new ApiError(500, "Failed to fetch posts")
        );
    }
};

// Delete a post
export const deletePost = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        
        // Find the post and verify ownership
        const post = await Post.findById(id);
        if (!post) {
            return res.status(404).json(
                new ApiError(404, "Post not found")
            );
        }
        
        // Check if user owns the post
        if (post.author.toString() !== userId.toString()) {
            return res.status(403).json(
                new ApiError(403, "Not authorized to delete this post")
            );
        }
        
        // Delete all answers for this post
        await Answer.deleteMany({ post: id });
        
        // Delete the post
        await Post.findByIdAndDelete(id);
        
        res.status(200).json(
            new ApiResponse(200, null, "Post deleted successfully")
        );
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json(
            new ApiError(500, "Failed to delete post")
        );
    }
};