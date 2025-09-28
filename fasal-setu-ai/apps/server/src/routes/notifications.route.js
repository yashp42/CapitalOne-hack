import express from 'express';
import User from '../models/user.model.js';
import cropNotificationService from '../services/cropNotifications.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get VAPID public key for client (public endpoint - no auth needed)
router.get('/vapid-public-key', (req, res) => {
    console.log('VAPID public key requested');
    if (!process.env.VAPID_PUBLIC_KEY) {
        console.log('VAPID_PUBLIC_KEY not found in environment');
        return res.status(503).json({ 
            error: 'Push notifications not configured',
            message: 'VAPID keys not set up'
        });
    }
    console.log('Returning VAPID public key');
    res.json({
        publicKey: process.env.VAPID_PUBLIC_KEY
    });
});

// Subscribe to push notifications
router.post('/subscribe', verifyJWT, async (req, res) => {
    try {
        const { subscription } = req.body;
        const userId = req.user._id;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Invalid subscription data' });
        }

        await User.findByIdAndUpdate(userId, {
            push_subscription: subscription
        });

        res.json({ message: 'Successfully subscribed to crop notifications' });
    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', verifyJWT, async (req, res) => {
    try {
        const userId = req.user._id;

        await User.findByIdAndUpdate(userId, {
            $unset: { push_subscription: 1 }
        });

        res.json({ message: 'Successfully unsubscribed from crop notifications' });
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).json({ error: 'Failed to unsubscribe' });
    }
});

// Manual trigger for testing
router.post('/test-notifications', verifyJWT, async (req, res) => {
    try {
        await cropNotificationService.triggerManualCheck();
        res.json({ message: 'Manual notification check triggered' });
    } catch (error) {
        console.error('Test notification error:', error);
        res.status(500).json({ error: 'Failed to trigger notifications' });
    }
});

export default router;