const jwt = require("jsonwebtoken");

/**
 * Google OAuth Success
 */
exports.googleAuthCallback = async (req, res) => {
  try {

    const user = req.user;

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const frontendUrl = process.env.CLIENT_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/login?token=${token}`);

  } catch (error) {
    res.status(500).json({
      message: "Authentication failed",
      error: error.message
    });
  }
};