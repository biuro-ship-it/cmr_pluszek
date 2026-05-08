import { db } from '../firebase.js';
import { sendEmail } from './gmail.js';
import { Client, FollowUp } from '../types.js';

export async function sendReminderNotifications() {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const clientsSnap = await db.collection('clients').get();
  
  for (const clientDoc of clientsSnap.docs) {
    const client = clientDoc.data() as Client;
    const followupsSnap = await clientDoc.ref.collection('followups')
      .where('status', '==', 'zaplanowane')
      .get();

    for (const doc of followupsSnap.docs) {
      const followup = doc.data() as FollowUp;
      
      // If due date is today or passed
      if (followup.dueDate <= today) {
        console.log(`🔔 Sending reminder for client ${client.companyName} (Follow-up: ${followup.note})`);
        
        // Update status to 'zalegle' if passed today (conceptually, in UI it's filtered)
        // For MVP, we just send an email reminder to the USER (the CRM owner)
        // In a real app, we'd send to the client or a specific assigned user.
        
        if (client.email) {
          try {
            await sendEmail({
              to: client.email, // Or owner's email
              subject: `PRZYPOMNIENIE: Kontakt z ${client.companyName}`,
              text: `Przypominamy o zaplanowanym kontakcie z ${client.companyName}.<br>Termin: ${followup.dueDate}<br>Notatka: ${followup.note}`
            });
          } catch (err) {
            console.error(`Failed to send reminder for ${client.companyName}:`, err);
          }
        }
      }
    }
  }
}
