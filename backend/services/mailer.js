import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP_USER and SMTP_PASS must be set in backend/.env');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        // Gmail shows app passwords in groups of four; strip the spaces if pasted that way.
        pass: process.env.SMTP_PASS.replace(/\s+/g, ''),
      },
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, text }) {
  const recipient = to || process.env.SHOPPING_LIST_RECIPIENT || process.env.SMTP_USER;
  return getTransporter().sendMail({
    from: process.env.SMTP_USER,
    to: recipient,
    subject,
    text,
  });
}
