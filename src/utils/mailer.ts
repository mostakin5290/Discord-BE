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
  username?: string;
}

/* ---------------- SEND SIGNUP OTP MAIL (NEW BEAUTIFUL TEMPLATE) ---------------- */
export const sendSignupOtpMail = async ({
  to,
  otp,
  username = "there",
}: SendOtpMailOptions): Promise<void> => {
  await transporter.sendMail({
    from: `"Discord Clone" <${EMAIL_USER}>`,
    to,
    subject: "Verify your email address",
    text: `Hi ${username}, Your verification code is ${otp}. This code will expire in 10 minutes.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #23272a;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #2c2f33;
          }
          .header {
            background: linear-gradient(135deg, #5865f2 0%, #7289da 100%);
            padding: 40px 20px;
            text-align: center;
          }
          .logo {
            font-size: 32px;
            font-weight: 800;
            color: #ffffff;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          .content {
            padding: 40px 30px;
            color: #dcddde;
          }
          .greeting {
            font-size: 24px;
            font-weight: 600;
            color: #ffffff;
            margin: 0 0 20px 0;
          }
          .message {
            font-size: 16px;
            line-height: 1.6;
            color: #b9bbbe;
            margin: 0 0 30px 0;
          }
          .otp-container {
            background-color: #202225;
            border: 2px solid #5865f2;
            border-radius: 8px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
          }
          .otp-label {
            font-size: 14px;
            color: #b9bbbe;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 0 0 15px 0;
          }
          .otp-code {
            font-size: 36px;
            font-weight: 700;
            color: #5865f2;
            letter-spacing: 8px;
            margin: 0;
            font-family: 'Courier New', monospace;
          }
          .expiry {
            font-size: 14px;
            color: #72767d;
            margin: 20px 0 0 0;
          }
          .warning {
            background-color: #faa61a1a;
            border-left: 4px solid #faa61a;
            padding: 15px 20px;
            margin: 30px 0;
            border-radius: 4px;
          }
          .warning-text {
            font-size: 14px;
            color: #faa61a;
            margin: 0;
          }
          .footer {
            background-color: #202225;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #40444b;
          }
          .footer-text {
            font-size: 13px;
            color: #72767d;
            margin: 5px 0;
          }
          .link {
            color: #5865f2;
            text-decoration: none;
          }
          .divider {
            height: 1px;
            background-color: #40444b;
            margin: 30px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="logo">Discord Clone</h1>
          </div>
          
          <div class="content">
            <h2 class="greeting">Hi ${username}! 👋</h2>
            <p class="message">
              Thanks for signing up! To complete your registration, please verify your email address by entering the code below:
            </p>
            
            <div class="otp-container">
              <p class="otp-label">Your Verification Code</p>
              <p class="otp-code">${otp}</p>
              <p class="expiry">⏰ This code will expire in 10 minutes</p>
            </div>
            
            <div class="warning">
              <p class="warning-text">
                ⚠️ If you didn't request this code, you can safely ignore this email.
              </p>
            </div>
            
            <div class="divider"></div>
            
            <p class="message" style="font-size: 14px;">
              Having trouble? Contact our support team at <a href="mailto:${EMAIL_USER}" class="link">${EMAIL_USER}</a>
            </p>
          </div>
          
          <div class="footer">
            <p class="footer-text">
              © ${new Date().getFullYear()} Discord Clone. All rights reserved.
            </p>
            <p class="footer-text">
              This is an automated message, please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

/* ---------------- SEND OTP MAIL (PASSWORD RESET) ---------------- */
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

