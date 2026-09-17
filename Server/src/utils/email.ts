import nodemailer from "nodemailer";
import { ENV } from "../config/env";

const transporter = nodemailer.createTransport({

    host: ENV.SMTP_HOST,
    port: Number(ENV.SMTP_PASSWORD),
    auth: ENV.SMTP_USER ? { user: ENV.SMTP_USER, pass: ENV.SMTP_PASSWORD } : undefined,
});

export const sendEmail = async (options: { to: string; subject: string; html: string }): Promise<void> => {
    await transporter.sendMail({
        from: ENV.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html
    });
};