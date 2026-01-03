import { Router } from "express";
import passport from "../config/passport.js";
import {
  login,
  signup,
  socialCallback,
} from "../controllers/auth.controller.js";
import multer from "multer";

const router = Router();
const upload = multer();

router.post("/signup", upload.none(), signup);
router.post("/login", upload.none(), login);

// Google Auth
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  socialCallback
);

// GitHub Auth
router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] })
);
router.get(
  "/github/callback",
  passport.authenticate("github", {
    session: false,
    failureRedirect: "/login",
  }),
  socialCallback
);

// Facebook Auth
router.get(
  "/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);
router.get(
  "/facebook/callback",
  passport.authenticate("facebook", {
    session: false,
    failureRedirect: "/login",
  }),
  socialCallback
);

export default router;
