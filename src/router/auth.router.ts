import { Router } from "express";
import { initiateRegistration, completeRegistration, login, refreshToken, logout, forgotPassword, resetPassword, changePassword } from "../controllers/auth.controller";
import { authenticate, } from "../middleware/auth.middleware";
import { handleValidationErrors } from "../middleware/validation.middleware";
import {
  completeRegisterValidation,
  initialRegValidation,
  loginValidation,
  refreshTokenValidation,
} from "../middleware/user.validator";
import { apiLimiter } from "../middleware/rate-limiter";

const router = Router();

// Step 1: User submits email to get an OTP
router.post("/send-otp", initialRegValidation,  initiateRegistration);
router.post("/register",  completeRegisterValidation, handleValidationErrors, completeRegistration);
router.post("/login",     loginValidation,    handleValidationErrors, login);
router.post("/refresh",  refreshTokenValidation, handleValidationErrors, refreshToken);
router.post("/logout",   authenticate, logout);

// ── Password Management ────────────────────────────────────────

// Public routes (user forgot password)
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Protected route (logged-in user updating password)
router.post("/change-password", authenticate, changePassword);

export default router;
