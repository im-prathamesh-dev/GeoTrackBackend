const Territory = require("../models/Territory");

exports.getAllTerritories = async (req, res) => {
  try {
    // Fetch all territories and populate user data to get their colors
    const territories = await Territory.find()
      .populate('userId', 'name profilePic color')
      .lean(); // Lean for faster query execution since we don't need mongoose methods

    // Format for frontend
    const formatted = territories.map(t => ({
      _id: t._id,
      userId: t.userId?._id,
      name: t.userId?.name || "Unknown Owner",
      color: t.userId?.color || "#10b981",
      area: t.area,
      polygon: t.polygon.coordinates[0] // Send the native [[lng, lat]] array
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching territories:", error);
    res.status(500).json({ error: error.message });
  }
};
