const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const territoryController = require("../controllers/territory.controller");

router.get("/", auth, territoryController.getAllTerritories);

module.exports = router;
