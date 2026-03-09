const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  route: {
    type: {
      type: String,
      enum: ["LineString", "Point"],
      default: "LineString"
    },
    coordinates: {
      type: [[Number]], // Array of numerical arrays: [[lng, lat], [lng, lat]]
      default: []
    }
  },

  distance: Number,
  radius: Number,
  startedAt: Date,
  endedAt: Date

});

// Removed the 2dsphere index here because MongoDB strictly requires a LineString to 
// have at least 2 valid points internally to index it. Since an activity starts with 0 
// or 1 points, keeping the index causes a 500 fatal validation error on MongoDB's end. 

module.exports = mongoose.model("Activity", activitySchema);