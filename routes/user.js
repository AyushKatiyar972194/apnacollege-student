const express = require("express");
const router = express.Router();
const User = require("../models/user.js");
const wrapAsync = require("../utils/wrapAsync.js");
const passport = require("passport");
const { saveRedirectUrl } = require("../middleware.js");
const {
  signupForm,
  signup,
  loginForm,
  login,
  logout,
  forgotPassword,
  resetPassword,
  resetPasswordForm,
  verifyEmail
} = require("../controllers/users.js");

router.route("/signup")
.get(signupForm)
.post(wrapAsync(signup));

router.route("/login")
.get(loginForm)
.post(
  saveRedirectUrl,
  (req, res, next) => {
    console.log('Login attempt - Body:', req.body);
    next();
  },
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res, next) => {
    console.log('After authentication - User:', req.user);
    console.log('After authentication - Is authenticated:', req.isAuthenticated());
    next();
  },
  login
);

router.post("/logout", logout);

// Forgot password routes
router.route("/forgot-password")
.get((req, res) => res.render("users/forgot-password.ejs"))
.post(wrapAsync(forgotPassword));

// Reset password routes
router.route("/reset-password/:token")
.get(wrapAsync(resetPasswordForm))
.post(wrapAsync(resetPassword));

// Email verification route
router.get("/verify-email/:token", wrapAsync(verifyEmail));

module.exports = router;
