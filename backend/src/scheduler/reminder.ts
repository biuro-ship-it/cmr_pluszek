// backend/src/scheduler/reminder.ts
import cron from 'node-cron';
import { sendReminderNotifications } from '../services/notification.js';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

// Scheduler runs every 30 minutes (as requested)
cron.schedule('*/30 * * * *', async () => {
  console.log('🔔 Running reminder scheduler (every 30 min)');
  try {
    await sendReminderNotifications();
    console.log('✅ Reminder notifications processed');
  } catch (err) {
    console.error('❌ Error in reminder scheduler', err);
  }
});

export default cron;
