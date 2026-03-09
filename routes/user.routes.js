const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const userController = require("../controllers/user.controller");

router.get("/stats", auth, userController.getUserStats);
router.get("/me", auth, userController.getMe);
router.get("/leaderboard", auth, userController.getLeaderboard);
router.get("/history", auth, userController.getHistory);

module.exports = router;
