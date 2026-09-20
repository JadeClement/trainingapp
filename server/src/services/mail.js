import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (transporter !== undefined) return transporter;

  if (process.env.SMTP_URL) {
    transporter = nodemailer.createTransport(process.env.SMTP_URL);
  } else if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  } else {
    transporter = null;
  }

  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || 'Training Log <noreply@localhost>';
  const transport = getTransporter();

  if (!transport) {
    console.log(`[mail] not sent (no SMTP configured)\nTo: ${to}\nSubject: ${subject}\n\n${text}`);
    return { delivered: false };
  }

  await transport.sendMail({ from, to, subject, text, html });
  return { delivered: true };
}
