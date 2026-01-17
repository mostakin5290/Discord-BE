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

/* ---------------- SEND DELIVERY OTP ---------------- */
// export const sendDeliveryOtpMail = async (
//   email: string,
//   otp: string | number
// ): Promise<void> => {
//   await transporter.sendMail({
//     from: `"Food Delivery" <${EMAIL_USER}>`,
//     to: email,
//     subject: "Delivery OTP",
//     text: `Your delivery OTP is ${otp}`,
//     html: `
//       <div>
//         <h3>Delivery Confirmation</h3>
//         <p>Your delivery OTP is <b>${otp}</b></p>
//         <p>Expires in 5 minutes.</p>
//       </div>
//     `,
//   });
// };
