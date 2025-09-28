import { Router } from "express";
import { 
    getPosts, 
    getPost, 
    createPost, 
    markPostAsSolved,
    markPostSolved, 
    getTags,
    getMyPosts,
    deletePost
} from "../controllers/community.controller.js";
import { 
    createAnswer, 
    getAnswers 
} from "../controllers/answer.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// Routes for posts
router.get('/posts', getPosts); // GET /api/community/posts?page=1&limit=10&tags=irrigation,pest-control&status=open
router.get('/posts/:id', getPost); // GET /api/community/posts/:id
router.post('/posts', verifyJWT, createPost); // POST /api/community/posts
router.patch('/posts/:id/solve/:answerId', verifyJWT, markPostAsSolved); // PATCH /api/community/posts/:id/solve/:answerId
router.patch('/posts/:id/mark-solved', verifyJWT, markPostSolved); // PATCH /api/community/posts/:id/mark-solved

// Routes for answers
router.post('/posts/:id/answers', verifyJWT, createAnswer); // POST /api/community/posts/:id/answers
router.get('/answers/:postId', getAnswers); // GET /api/community/answers/:postId

// Routes for tags
router.get('/tags', getTags); // GET /api/community/tags

// Routes for user posts
router.get('/my-posts', verifyJWT, getMyPosts); // GET /api/community/my-posts
router.delete('/posts/:id', verifyJWT, deletePost); // DELETE /api/community/posts/:id

export default router;