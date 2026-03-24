import nodemailer from "nodemailer";
import dotenv from "dotenv"

dotenv.config()

// Configure the SMTP transporter (Use your actual credentials in .env)
const transporter = nodemailer.createTransport({
  service: "gmail", // e.g., 'gmail', 'sendgrid', etc.
  auth: {
    user: process.env.EMAIL, // Your email address
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendEmail = async (to: string, subject: string, text: string): Promise<void> => {
  try {
    await transporter.sendMail({
      from: `"School Search" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Could not send email");
  }
};