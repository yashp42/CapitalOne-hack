import Answer from '../models/answer.model.js';
import Post from '../models/post.model.js';
import { ApiResponse } from '../util/ApiResponse.js';
import { ApiError } from '../util/ApiError.js';

// Create new answer
export const createAnswer = async (req, res) => {
    try {
        const { id: postId } = req.params;
        const { content } = req.body;
        const userId = req.user._id;

        // Validation
        if (!content || content.trim().length === 0) {
            return res.status(400).json(
                new ApiError(400, "Answer content is required")
            );
        }

        if (content.length < 10 || content.length > 500) {
            return res.status(400).json(
                new ApiError(400, "Answer must be between 10 and 500 characters")
            );
        }

        // Check if post exists
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json(
                new ApiError(404, "Post not found")
            );
        }

        const answer = new Answer({
            content: content.trim(),
            author: userId,
            post: postId,
            language: req.user.preferred_language || 'en-IN'
        });

        await answer.save();
        await answer.populate('author', 'firstName lastName phoneNumber');

        res.status(201).json(
            new ApiResponse(201, answer, "Answer created successfully")
        );
    } catch (error) {
        console.error('Error creating answer:', error);
        res.status(500).json(
            new ApiError(500, "Failed to create answer")
        );
    }
};

// Get answers for a post
export const getAnswers = async (req, res) => {
    try {
        const { postId } = req.params;

        // Check if post exists
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json(
                new ApiError(404, "Post not found")
            );
        }

        const answers = await Answer.findByPost(postId);

        res.status(200).json(
            new ApiResponse(200, { answers }, "Answers fetched successfully")
        );
    } catch (error) {
        console.error('Error fetching answers:', error);
        res.status(500).json(
            new ApiError(500, "Failed to fetch answers")
        );
    }
};