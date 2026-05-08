import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

export async function sendEmail({ to, subject, text, attachPdf }: { to: string, subject: string, text: string, attachPdf?: boolean }) {
  // Construct email message
  let message = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    text
  ].join('\n');

  // Basic implementation – adding attachments would require base64 multipart encoding
  // For MVP, we'll just log the attachment request if attachPdf is true
  if (attachPdf) {
    message += '\n\n[ZAŁĄCZNIK: Katalog_Produktowy.pdf]';
  }

  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });
}
