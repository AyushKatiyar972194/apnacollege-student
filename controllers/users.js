const User = require("../models/user.js");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

// Create a transporter for sending emails
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

function signupForm(req, res) {
  res.render("users/signup.ejs");
}

async function signup(req, res) {
  try {
    let { username, email, password, confirmPassword } = req.body;

    // Validate password match
    if (password !== confirmPassword) {
      req.flash("error", "Passwords do not match");
      return res.redirect("/signup");
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash("error", "Email already registered");
      return res.redirect("/signup");
    }

    // Create new user
    const newUser = new User({ email, username });
    const registeredUser = await User.register(newUser, password);

    // Generate verification token
    const verificationToken = crypto.randomBytes(20).toString('hex');
    registeredUser.verificationToken = verificationToken;
    registeredUser.verificationTokenExpires = Date.now() + 24 * 3600000; // 24 hours
    await registeredUser.save();

    // Send verification email
    const verificationUrl = `${req.protocol}://${req.get('host')}/verify-email/${verificationToken}`;
    const mailOptions = {
      to: registeredUser.email,
      from: process.env.EMAIL_USER,
      subject: 'Verify your email address',
      text: `Welcome to FortuneVila! Please click on the following link to verify your email address:\n\n
        ${verificationUrl}\n\n
        This link will expire in 24 hours.\n`
    };

    await transporter.sendMail(mailOptions);

    // Log the user in
    req.login(registeredUser, (err) => {
      if (err) {
        return next(err);
      }
      req.flash("success", "Welcome to FortuneVila! Please check your email to verify your account.");
      res.redirect("/listings");
    });
  } catch (e) {
    console.error("Signup error:", e);
    req.flash("error", e.message);
    res.redirect("/signup");
  }
}

// Add email verification function
async function verifyEmail(req, res) {
  try {
    const user = await User.findOne({
      verificationToken: req.params.token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash("error", "Email verification token is invalid or has expired.");
      return res.redirect("/login");
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    req.flash("success", "Your email has been verified. You can now log in.");
    res.redirect("/login");
  } catch (error) {
    console.error("Email verification error:", error);
    req.flash("error", "An error occurred during email verification.");
    res.redirect("/login");
  }
}

function loginForm(req, res) {
  res.render("users/login.ejs");
}

function login(req, res) {
  console.log('Login controller - User:', req.user);
  console.log('Login controller - Is authenticated:', req.isAuthenticated());
  console.log('Login controller - Session:', req.session);
  
  // Ensure the user is properly set in the session
  req.session.user = req.user;
  req.session.save((err) => {
    if (err) {
      console.error('Error saving session:', err);
    }
    console.log('Session saved with user:', req.session.user);
  });
  
  req.flash("success", "Welcome back to FortuneVila!");
  const redirectUrl = res.locals.redirectUrl || "/listings";
  console.log('Redirecting to:', redirectUrl);
  res.redirect(redirectUrl);
}

function logout(req, res, next) {
  console.log('Logout - User before logout:', req.user);
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return next(err);
    }
    console.log('Logout - User after logout:', req.user);
    req.flash("success", "You have been logged out!");
    res.redirect("/listings");
  });
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      req.flash("error", "No account with that email address exists.");
      return res.redirect("/forgot-password");
    }

    // Generate reset token
    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // Token expires in 1 hour
    await user.save();

    // Send reset email
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: 'Password Reset',
      text: `You are receiving this because you (or someone else) has requested the reset of the password for your account.\n\n
        Please click on the following link, or paste this into your browser to complete the process:\n\n
        ${resetUrl}\n\n
        If you did not request this, please ignore this email and your password will remain unchanged.\n`
    };

    await transporter.sendMail(mailOptions);
    req.flash("success", "Check your email for password reset instructions.");
    res.redirect("/login");
  } catch (error) {
    console.error("Forgot password error:", error);
    req.flash("error", "An error occurred. Please try again.");
    res.redirect("/forgot-password");
  }
}

async function resetPasswordForm(req, res) {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash("error", "Password reset token is invalid or has expired.");
      return res.redirect("/forgot-password");
    }

    res.render("users/reset-password.ejs", { token: req.params.token });
  } catch (error) {
    console.error("Reset password form error:", error);
    req.flash("error", "An error occurred. Please try again.");
    res.redirect("/forgot-password");
  }
}

async function resetPassword(req, res) {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash("error", "Password reset token is invalid or has expired.");
      return res.redirect("/forgot-password");
    }

    // Set new password
    await user.setPassword(req.body.password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    req.flash("success", "Your password has been updated.");
    res.redirect("/login");
  } catch (error) {
    console.error("Reset password error:", error);
    req.flash("error", "An error occurred. Please try again.");
    res.redirect("/forgot-password");
  }
}

module.exports = { 
  signupForm, 
  signup, 
  loginForm, 
  login, 
  logout,
  forgotPassword,
  resetPassword,
  resetPasswordForm,
  verifyEmail
};
