import { google } from 'googleapis';

// Klient Gmail API oparty o OAuth2 (refresh token konta firmowego).
// Reużywa zmiennych już obecnych w backend/.env: GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN. Nadawca: GMAIL_FROM.
export const getGmailClient = () => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Brak konfiguracji Gmail API w .env (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    'http://localhost:3456/callback'
  );

  oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth: oauth2Client });
};

interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
}

const buildRawMessage = (options: SendEmailOptions, sender: string): string => {
  const { to, subject, htmlBody } = options;

  const encodeBase64Url = (str: string) =>
    Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const subjectEncoded = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;

  const raw = [
    `From: ${sender}`,
    `To: ${to}`,
    `Subject: ${subjectEncoded}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    '',
    htmlBody,
  ].join('\r\n');

  return encodeBase64Url(raw);
};

export const sendEmail = async (options: SendEmailOptions): Promise<void> => {
  const gmail = getGmailClient();
  const sender = process.env.GMAIL_FROM || 'biuro@antyramy.eu';

  const raw = buildRawMessage(options, sender);
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
};
