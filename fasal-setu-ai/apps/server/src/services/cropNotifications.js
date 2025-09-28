import cron from 'node-cron';
import webpush from 'web-push';
import Crop from '../models/crop.model.js';
import User from '../models/user.model.js';

// Configure web-push - only if VAPID keys are provided
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:your-email@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
} else {
    console.log('⚠️  VAPID keys not configured. Push notifications will not work.');
    console.log('Generate VAPID keys using: npx web-push generate-vapid-keys');
}

class CropNotificationService {
    constructor() {
        this.startCronJob();
    }

    startCronJob() {
        // Run every day at 9 AM
        cron.schedule('0 9 * * *', async () => {
            console.log('Running daily crop event notifications...');
            await this.checkAndSendNotifications();
        });

        console.log('Crop notification cron job started - runs daily at 9 AM');
    }

    async checkAndSendNotifications() {
        try {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Find crops with events due today or tomorrow
            const cropsWithEvents = await Crop.find({
                status: 'active',
                'derived.next_event_due_date': {
                    $lte: tomorrow,
                    $gte: today
                },
                'derived.next_event': { $ne: 'none' }
            }).populate('owner_id');

            console.log(`Found ${cropsWithEvents.length} crops with upcoming events`);

            for (const crop of cropsWithEvents) {
                if (crop.owner_id && crop.owner_id.push_subscription) {
                    await this.sendCropEventNotification(crop);
                }
            }
        } catch (error) {
            console.error('Error in crop notification service:', error);
        }
    }

    async sendCropEventNotification(crop) {
        const user = crop.owner_id;
        const eventType = crop.derived.next_event;
        const daysUntil = crop.derived.next_event_days_until || 0;

        const notificationData = this.getNotificationContent(crop, eventType, daysUntil);

        const payload = JSON.stringify({
            title: notificationData.title,
            body: notificationData.body,
            icon: '/assets/crop-icon.png',
            badge: '/assets/badge-icon.png',
            data: {
                cropId: crop._id,
                eventType: eventType,
                url: `/crop-simulation?cropId=${crop._id}`
            }
        });

        try {
            await webpush.sendNotification(user.push_subscription, payload);
            console.log(`Notification sent to user ${user._id} for crop ${crop.crop_name}`);
        } catch (error) {
            console.error(`Failed to send notification to user ${user._id}:`, error);
            
            // Remove invalid subscription
            if (error.statusCode === 410) {
                await User.findByIdAndUpdate(user._id, {
                    $unset: { push_subscription: 1 }
                });
            }
        }
    }

    getNotificationContent(crop, eventType, daysUntil) {
        const cropName = crop.crop_name;
        const timeText = daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`;

        const eventMessages = {
            irrigation: {
                title: `💧 Irrigation Due for ${cropName}`,
                body: `Your ${cropName} crop needs watering ${timeText}. Tap to view details.`
            },
            fertilization: {
                title: `🌱 Fertilization Due for ${cropName}`,
                body: `Time to fertilize your ${cropName} crop ${timeText}. Check recommendations.`
            },
            pest_check: {
                title: `🔍 Pest Check Due for ${cropName}`,
                body: `Inspect your ${cropName} crop for pests ${timeText}. Stay vigilant!`
            },
            harvesting: {
                title: `🌾 Harvest Time for ${cropName}`,
                body: `Your ${cropName} crop is ready for harvest ${timeText}! Great work!`
            }
        };

        return eventMessages[eventType] || {
            title: `📅 Crop Event for ${cropName}`,
            body: `You have a ${eventType} event due ${timeText}.`
        };
    }

    // Manual trigger for testing
    async triggerManualCheck() {
        console.log('Manual crop notification check triggered');
        await this.checkAndSendNotifications();
    }
}

export default new CropNotificationService();