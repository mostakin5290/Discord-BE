import { Router } from "express";
import passport from "../config/passport.js";
import {
  login,
  signup,
  socialCallback,
  getMe,
  sendOtp,
  verifyOtp,
  resetPassword,
  updateProfile,
  updatePassword,
  deleteAccount,
  disableAccount,
} from "../controllers/auth.controller.js";
import multer from "multer";
import { protect } from "../middleware/user.middleware.js";

const router = Router();
const upload = multer();

router.post("/signup", upload.none(), signup);
router.post("/login", upload.none(), login);

// Forgot / Reset password
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);

// Get current authenticated user
router.get("/me", protect, getMe);
router.put(
  "/profile",
  protect,
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "banner", maxCount: 1 },
  ]),
  updateProfile,
);
router.put("/password", protect, updatePassword);
router.delete("/account", protect, deleteAccount);
router.post("/account/disable", protect, disableAccount);

// Google Auth
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  }),
);
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  socialCallback,
);

// GitHub Auth
router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] }),
);
router.get(
  "/github/callback",
  passport.authenticate("github", {
    session: false,
    failureRedirect: "/login",
  }),
  socialCallback,
);

// Facebook Auth
router.get(
  "/facebook",
  passport.authenticate("facebook", { scope: ["email"] }),
);
router.get(
  "/facebook/callback",
  passport.authenticate("facebook", {
    session: false,
    failureRedirect: "/login",
  }),
  socialCallback,
);

export default router;
