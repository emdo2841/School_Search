import { Request, Response } from "express";
import { AuthRequest } from "../types/index";
import User from "../models/user";  // ← make sure filename matches (user.model.ts not user.ts)
import { generateTokens, verifyRefreshToken } from "../utils/jwt";
// import { validatePhoneNumber } from "../utils/phone.validator";
import { sendEmail } from "../utils/mailer";
import crypto from "crypto"; // Native Node.js module for secure tokens
import {
  storeRefreshToken,
  getStoredRefreshToken,
  deleteRefreshToken,
  blacklistToken,
  cacheDel,
  storeTempUser,
  getTempUser,
  deleteTempUser,
  getResetToken,
  deleteResetToken,
  storeResetToken
} from "../utils/redis-helpers";

// ── 1. Step One: Initiate Registration (Email & Password) ─────────

export const initiateRegistration = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: "Email and password are required" });
      return;
    }

    // Check if user already exists
    const existingEmail = await User.findOne({ email }).lean();
    if (existingEmail) {
      res.status(409).json({ success: false, message: "Email already registered" });
      return;
    }

    // Generate a secure, random 32-character token
    const token = crypto.randomBytes(32).toString("hex");

    // Store email & password temporarily in Redis tied to the token
    await storeTempUser(token, { email, password });

    // Build the Magic Link (Change this to your actual frontend URL in production)
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const registrationLink = `${frontendUrl}/complete-registration?token=${token}`;

    // Send the email
    const message = `Welcome! Please click the link below to complete your registration:\n\n${registrationLink}\n\nThis link will expire in 15 minutes.`;
    await sendEmail(email, "Complete Your Registration", message);

    res.status(200).json({
      success: true,
      message: "Registration link sent to your email."
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


// ── 2. Step Two: Complete Registration (URL Token + Profile Details) ──

export const completeRegistration = async (req: Request, res: Response): Promise<void> => {
  try {
    // The frontend extracts the 'token' from the URL and sends it in the body with the rest of the data
    const { token, first_name, last_name, phone, role, state, lga, street } = req.body;

    if (!token) {
      res.status(400).json({ success: false, message: "Registration token is missing" });
      return;
    }

    // 1. Retrieve the email and password from Redis using the token
    const tempData = await getTempUser(token);

    if (!tempData) {
      res.status(400).json({ success: false, message: "Registration link is invalid or has expired" });
      return;
    }

    const { email, password } = tempData;

    // // 2. Validate the new details
    // const isPhoneValid = await validatePhoneNumber(phone);
    // if (!isPhoneValid) {
    //   res.status(400).json({ success: false, message: "Invalid phone number format" });
    //   return;
    // }

    const existingPhone = await User.findOne({ phone }).lean();
    if (existingPhone) {
      res.status(409).json({ success: false, message: "Phone number already registered" });
      return;
    }

    // 3. Create the user in MongoDB
    const user = await User.create({
      first_name,
      last_name,
      email, // Pulled securely from Redis
      password, // Pulled securely from Redis (Mongoose will hash it)
      role,
      state,
      lga,
      street,
      phone,
    });

    // 4. Delete the token from Redis so the link cannot be reused
    await deleteTempUser(token);

    // 5. Generate Auth Tokens & Log the user in
    const tokens = generateTokens({
      userId: String(user._id),
      role: user.role,
      email: user.email,
    });
    await storeRefreshToken(String(user._id), tokens.refreshToken);

    res.status(201).json({
      success: true,
      message: "Registration complete!",
      data: {
        user: {
          id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          role: user.role,
        },
        ...tokens,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Registration failed", error: error.message });
  }
};

// ── Login ────────────────────────────────────────────────────────

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  // password has select:false on the schema — must explicitly re-add it here
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    res.status(401).json({ success: false, message: "Invalid email or password" });
    return;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    res.status(401).json({ success: false, message: "Invalid email or password" });
    return;
  }

  const tokens = generateTokens({
    userId: String(user._id),
    role: user.role,
    email: user.email,
  });
  await storeRefreshToken(String(user._id), tokens.refreshToken);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: {
        id: user._id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
      },
      ...tokens,
    },
  });
};

// ── Refresh Token ────────────────────────────────────────────────

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  const { refreshToken: token } = req.body;

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
    return;
  }

  const stored = await getStoredRefreshToken(payload.userId);
  if (!stored || stored !== token) {
    res.status(401).json({ success: false, message: "Refresh token mismatch or revoked" });
    return;
  }

  const tokens = generateTokens({
    userId: payload.userId,
    role: payload.role,
    email: payload.email,
  });
  await storeRefreshToken(payload.userId, tokens.refreshToken);

  res.status(200).json({ success: true, data: tokens });
};

// ── 3. Forgot Password (Generates Link) ──────────────────────────

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: "Email is required" });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Security best practice: Don't explicitly say the email doesn't exist, 
      // just return a generic success message so attackers can't fish for emails.
      res.status(200).json({ success: true, message: "If that email is registered, a reset link has been sent." });
      return;
    }

    // Generate a secure token and store it in Redis tied to the user's ID
    const resetToken = crypto.randomBytes(32).toString("hex");
    await storeResetToken(resetToken, String(user._id));

    // Send the email (Change frontendUrl for production)
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    const message = `You requested a password reset. Click the link below to set a new password:\n\n${resetLink}\n\nIf you did not request this, please ignore this email. This link expires in 15 minutes.`;
    await sendEmail(email, "Password Reset Request", message);

    res.status(200).json({ success: true, message: "If that email is registered, a reset link has been sent." });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ── 4. Reset Password (Using the Link) ───────────────────────────

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ success: false, message: "Token and new password are required" });
      return;
    }

    // Verify token in Redis
    const userId = await getResetToken(token);
    if (!userId) {
      res.status(400).json({ success: false, message: "Invalid or expired reset token" });
      return;
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    // Update password (your Mongoose pre-save hook will hash it automatically!)
    user.password = newPassword;
    await user.save();

    // Delete the token so it can't be reused
    await deleteResetToken(token);

    res.status(200).json({ success: true, message: "Password has been reset successfully. You can now log in." });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ── 5. Change Password (For Logged-In Users) ─────────────────────

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user!.userId; // Pulled from your auth middleware

    if (!oldPassword || !newPassword) {
      res.status(400).json({ success: false, message: "Old and new passwords are required" });
      return;
    }

    // Explicitly select the password field so we can compare it
    const user = await User.findById(userId).select("+password");
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    // Verify the old password
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      res.status(401).json({ success: false, message: "Incorrect current password" });
      return;
    }

    // Update to the new password
    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// ── Logout ────────────────────────────────────────────────────────

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const authHeader = req.headers.authorization!;
  const accessToken = authHeader.split(" ")[1];

  // Blacklist access token for remainder of its 15m TTL + purge refresh token + cache
  await Promise.all([
    blacklistToken(accessToken, 15 * 60),
    deleteRefreshToken(userId),
    cacheDel(`user:${userId}`),
  ]);

  res.status(200).json({ success: true, message: "Logged out successfully" });
};