import nodemailer from "nodemailer";
import { loadEnv } from "../src/config/env.js";
const env = loadEnv();
if (env.MAIL_TRANSPORT !== "smtp")
  throw new Error(
    "Set MAIL_TRANSPORT=smtp and your SMTP settings in back-end/.env first.",
  );
const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  requireTLS: env.SMTP_PORT !== 465,
  auth: env.SMTP_USER
    ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
    : undefined,
  connectionTimeout: 10000,
  socketTimeout: 15000,
});
try {
  await transport.verify();
  console.log(
    "SMTP connection and authentication succeeded. No email was sent; sender acceptance and inbox delivery still need a signup test.",
  );
} catch {
  throw new Error(
    "SMTP verification failed. Check the host, port, credentials and network. For Gmail use an App Password, not your normal password.",
  );
} finally {
  transport.close();
}
