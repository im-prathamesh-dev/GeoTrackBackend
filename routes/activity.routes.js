const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth.middleware");
const activityController = require("../controllers/activity.controller");

router.post("/start", auth, activityController.startActivity);
router.post("/location", auth, activityController.addLocation);
router.post("/end", auth, activityController.endActivity);

module.exports = router;
