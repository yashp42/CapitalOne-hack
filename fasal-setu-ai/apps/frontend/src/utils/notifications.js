// Push Notification Utility for Crop Events
class CropNotificationManager {
    constructor() {
        this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
        this.registration = null;
        this.publicKey = null;
    }

    async initialize() {
        if (!this.isSupported) {
            console.log('Push notifications not supported');
            return false;
        }

        try {
            // Register service worker
            this.registration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered successfully');

            // Wait for service worker to be ready
            await navigator.serviceWorker.ready;
            console.log('Service Worker is ready');

            // Get VAPID public key
            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8080'}/api/notifications/vapid-public-key`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch VAPID key: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('VAPID key response:', data);
            
            if (!data.publicKey) {
                throw new Error('No public key received from server');
            }
            
            this.publicKey = data.publicKey;
            console.log('VAPID public key set:', this.publicKey.substring(0, 20) + '...');

            return true;
        } catch (error) {
            console.error('Failed to initialize notifications:', error);
            return false;
        }
    }

    async requestPermission() {
        if (!this.isSupported) return false;

        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    async subscribe() {
        console.log('Subscribe called - checking prerequisites...');
        console.log('Registration:', !!this.registration);
        console.log('Public key:', !!this.publicKey);
        
        if (!this.registration || !this.publicKey) {
            console.error('Notification manager not initialized properly');
            console.error('Registration exists:', !!this.registration);
            console.error('Public key exists:', !!this.publicKey);
            return false;
        }

        try {
            console.log('Creating push subscription...');
            const subscription = await this.registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(this.publicKey)
            });
            console.log('Push subscription created:', subscription);

            // Send subscription to server
            console.log('Sending subscription to server...');
            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8080'}/api/notifications/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                },
                body: JSON.stringify({ subscription }),
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${await response.text()}`);
            }

            console.log('Successfully subscribed to crop notifications');
            return true;
        } catch (error) {
            console.error('Failed to subscribe:', error);
            return false;
        }
    }

    async unsubscribe() {
        try {
            const subscription = await this.registration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
            }

            await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8080'}/api/notifications/unsubscribe`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                },
            });

            console.log('Successfully unsubscribed from crop notifications');
            return true;
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
            return false;
        }
    }

    async isSubscribed() {
        if (!this.registration) return false;
        
        const subscription = await this.registration.pushManager.getSubscription();
        return !!subscription;
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}

export default new CropNotificationManager();