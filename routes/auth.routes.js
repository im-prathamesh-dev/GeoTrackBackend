const express = require("express");
const passport = require("passport");

const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");
const router = express.Router();

/* Redirect to Google */
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

/* Google Callback */
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=auth_failed` }),
  authController.googleAuthCallback
);
router.get("/profile", authMiddleware, (req, res) => {
  res.json({
    message: "Protected route",
    userId: req.user.id
  });
});


module.exports = router;