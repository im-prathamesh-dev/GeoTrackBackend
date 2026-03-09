const Activity = require("../models/Activity");
const Territory = require("../models/Territory");
const User = require("../models/User");

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-__v");
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Total Activities
    const activitiesCount = await Activity.countDocuments({ userId });

    // Total Area
    const territories = await Territory.find({ userId });
    // Area is probably stored in square meters by Turf, let's convert to sq km
    let totalAreaSqMeters = 0;
    territories.forEach(t => {
      if (t.area) totalAreaSqMeters += t.area;
    });
    const totalAreaSqKm = (totalAreaSqMeters / 1000000).toFixed(2);

    // Global Rank (find how many users have more area than this user)
    const pipeline = [
      {
        $group: {
          _id: "$userId",
          totalArea: { $sum: "$area" }
        }
      },
      { $sort: { totalArea: -1 } }
    ];
    
    const allUsersArea = await Territory.aggregate(pipeline);
    let rank = allUsersArea.length > 0 ? allUsersArea.length + 1 : 1;
    for (let i = 0; i < allUsersArea.length; i++) {
      if (allUsersArea[i]._id.toString() === userId.toString()) {
        rank = i + 1;
        break;
      }
    }

    // Recent Activities (last 5)
    const recentActivities = await Activity.find({ userId })
      .sort({ createdAt: -1, startedAt: -1 })
      .limit(5);

    const formattedRecent = recentActivities.map(act => {
       return {
         id: act._id,
         title: "Activity", // Mock title as no name exists on model
         date: act.startedAt ? new Date(act.startedAt).toLocaleString() : new Date().toLocaleString(),
         distance: act.distance ? (act.distance / 1000).toFixed(2) + " km" : "-- km",
         area: "--" // Could calculate from related territory but keep it simple
       }
    });

    res.json({
      activities: activitiesCount,
      territoryArea: totalAreaSqKm,
      rank,
      recentActivities: formattedRecent
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const pipeline = [
      {
        $group: {
          _id: "$userId",
          totalArea: { $sum: "$area" }
        }
      },
      { $sort: { totalArea: -1 } },
      { $limit: 10 }
    ];
    
    const topTerritories = await Territory.aggregate(pipeline);
    
    // Populate user info
    const populatedLeaderboard = await Promise.all(
      topTerritories.map(async (t, index) => {
        const user = await User.findById(t._id);
        return {
          id: t._id,
          name: user ? user.name : "Unknown",
          area: (t.totalArea / 1000000).toFixed(2),
          rank: index + 1,
          points: Math.floor(t.totalArea / 100), // Mock points
          previousR: index + 1,
          isUser: req.user && t._id.toString() === req.user.id.toString()
        };
      })
    );

    res.json(populatedLeaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const activities = await Activity.find({ userId: req.user.id })
      .sort({ startedAt: -1 })
      .limit(20);

    const history = activities.map(act => {
      
      let durationStr = "--";
      if(act.startedAt && act.endedAt) {
        const diff = new Date(act.endedAt) - new Date(act.startedAt);
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        durationStr = `${mins}m ${secs}s`;
      }

      return {
        id: act._id,
        title: "Territory Run",
        date: act.startedAt ? new Date(act.startedAt).toLocaleString() : "Unknown",
        duration: durationStr,
        distance: act.distance ? (act.distance / 1000).toFixed(2) : "0.00",
        area: "--",
        color: "indigo"
      }
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
