import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

/* ---------------- ENV VALIDATION ---------------- */
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

if (!EMAIL_USER || !EMAIL_PASS) {
  throw new Error("EMAIL_USER or MAIL_PASS is missing in .env file");
}

/* ---------------- TRANSPORTER ---------------- */
const transporter: Transporter = nodemailer.createTransport({
  service: "Gmail",
  port: 465,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS, // Gmail App Password
  },
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 5000,
  socketTimeout: 15000,
});

/* ---------------- TYPES ---------------- */
export interface SendOtpMailOptions {
  to: string;
  otp: string | number;
}

/* ---------------- SEND OTP MAIL ---------------- */
export const sendOtpMail = async ({
  to,
  otp,
}: SendOtpMailOptions): Promise<void> => {
  await transporter.sendMail({
    from: `"Discord Web" `,
    to,
    subject: "Reset Your Password",
    text: `Your OTP is ${otp}`,
    html: `
      <div>
        <h3>Password Reset</h3>
        <p>Your OTP is <b>${otp}</b></p>
        <p>This OTP will expire in 5 minutes.</p>
      </div>
    `,
  });
};

