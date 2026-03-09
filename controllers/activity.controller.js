const Activity = require("../models/Activity");
const Territory = require("../models/Territory");
const turf = require("@turf/turf");

exports.startActivity = async (req,res)=>{
 try {
  const { startLocation } = req.body; // Expects [lng, lat]
  
  // A valid LineString MUST have at least 2 points.
  const initialCoords = startLocation ? [startLocation, startLocation] : [[0,0], [0,0]];

  const activity = await Activity.create({
   userId:req.user.id,
   route:{
    type:"LineString",
    coordinates: initialCoords
   },
   startedAt:new Date()
  });

  res.json(activity);
 } catch (err) {
  console.error("Error starting activity:", err);
  res.status(500).json({ error: err.message });
 }
};

exports.addLocation = async (req,res)=>{
 try {
  const {activityId,lat,lng} = req.body;

  const activity = await Activity.findById(activityId).populate('userId', 'name profilePic color');
  if (!activity) {
   return res.status(404).json({ error: "Activity not found" });
  }

  activity.route.coordinates.push([lng,lat]);
  await activity.save();

  // Broadcast to other users
  const io = req.app.get('io');
  if (io && activity.userId) {
    io.emit('locationUpdate', {
      userId: activity.userId._id,
      name: activity.userId.name,
      profilePic: activity.userId.profilePic,
      color: activity.userId.color || '#10b981', // Fallback color
      lat,
      lng
    });
  }

  res.json({message:"Location added"});
 } catch (err) {
  console.error("Error adding location:", err);
  res.status(500).json({ error: err.message });
 }
};

exports.endActivity = async (req,res)=>{
 try {
  const {activityId} = req.body;

  const activity = await Activity.findById(activityId);
  if (!activity) {
   return res.status(404).json({ error: "Activity not found" });
  }

  activity.endedAt = new Date();

  const coords = activity.route.coordinates;

  if (coords && coords.length >= 2) {
   const start = coords[0];
   const end = coords[coords.length-1];

   const distance = turf.distance(
    turf.point(start),
    turf.point(end),
    {units:"meters"}
   );

   if(distance < 50){
    const polygonCoords = [...coords,start];

    // Ensure polygon is valid (at least 4 points)
    if (polygonCoords.length >= 4) {
      const polygon = turf.polygon([polygonCoords]);
      const area = turf.area(polygon);

      // 1. Process Territory Takeovers (Slicing)
      const existingTerritories = await Territory.find();
      
      for (const oldTerritory of existingTerritories) {
        // Skip comparing against ourselves if we want players to be able to overlap their own land (optional)
        // For hardcore mode, we'll let players overwrite their own old tracks too, keeping the newest.
        
        try {
          const oldPoly = turf.polygon(oldTerritory.polygon.coordinates);
          
          // Check if the new polygon intersects the old one
          if (turf.booleanIntersects(polygon, oldPoly)) {
            // Subtract the new polygon from the old polygon
            const difference = turf.difference(turf.featureCollection([oldPoly, polygon]));
            
            if (!difference) {
              // The old territory was completely swallowed up by the new one
              await Territory.findByIdAndDelete(oldTerritory._id);
            } else if (difference.geometry.type === 'Polygon' || difference.geometry.type === 'MultiPolygon') {
              // The old territory was partially eaten
              
              // Note: difference might return a MultiPolygon if it split the old one in two.
              // For simplicity, if it returns a MultiPolygon, we can either save it as is (if schema supports),
              // or just save the largest piece. Let's update the schema dynamically or assume Polygon.
              // Mongoose Schema is strict to "Polygon", so if it's a MultiPolygon we'll just take the biggest chunk.
              
              let newGeometry = difference.geometry;
              
              if (newGeometry.type === 'MultiPolygon') {
                // Find the largest polygon in the multipolygon
                let maxArea = 0;
                let biggestPolyCoords = null;
                
                newGeometry.coordinates.forEach(coords => {
                  const p = turf.polygon(coords);
                  const pArea = turf.area(p);
                  if (pArea > maxArea) {
                    maxArea = pArea;
                    biggestPolyCoords = coords;
                  }
                });
                
                newGeometry = { type: 'Polygon', coordinates: biggestPolyCoords };
              }
              
              const newArea = turf.area(turf.polygon(newGeometry.coordinates));
              
              if (newArea < 10) { 
                // If the remaining sliver is tiny, just delete it
                await Territory.findByIdAndDelete(oldTerritory._id);
              } else {
                // Update the old territory with its new sliced geometry
                oldTerritory.polygon = newGeometry;
                oldTerritory.area = newArea;
                await oldTerritory.save();
              }
            }
          }
        } catch (geomErr) {
          console.error("Geometry Intersection Error (skipping this poly):", geomErr);
        }
      }

      // 2. Save the new Territory
      const territory = await Territory.create({
       userId:activity.userId,
       polygon:polygon.geometry,
       area
      });
      
      // 3. Tell all clients to re-fetch the global map geometries
      const io = req.app.get('io');
      if (io) {
        io.emit('territoryUpdate');
      }
    }
   }
  }

  await activity.save();

  // Notify clients this user stopped tracking
  const io = req.app.get('io');
  if (io) {
    io.emit('activityEnded', { userId: req.user.id });
  }

  res.json(activity);
 } catch (err) {
  console.error("Error ending activity:", err);
  res.status(500).json({ error: err.message });
 }
};