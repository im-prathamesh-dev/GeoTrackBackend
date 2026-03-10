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

  try {
    if (coords && coords.length >= 2) {
     const start = coords[0];
     const end = coords[coords.length-1];

     // Validate points before passing to Turf
     if (Array.isArray(start) && Array.isArray(end) && start.length === 2 && end.length === 2) {
       // Straight-line displacement to check if they completed a loop
       const displacement = turf.distance(
        turf.point(start),
        turf.point(end),
        {units:"meters"}
       );
       
       // Actual physical distance traveled along the path
       const totalDistance = turf.length(turf.lineString(coords), {units: "meters"});
       activity.distance = totalDistance;

       if(displacement < 50){
        const polygonCoords = [...coords, start]; // Close the polygon

        // Ensure polygon is valid (at least 4 points needed for a closed ring)
        if (polygonCoords.length >= 4) {
          const polygon = turf.polygon([polygonCoords]);
          const area = turf.area(polygon);

          // 1. Process Territory Takeovers and Merges
          const existingTerritories = await Territory.find();
          
          let myCombinedGeometry = polygon; // Start with the new polygon
          let territoriesToDelete = [];
          
          for (const oldTerritory of existingTerritories) {
            try {
              const oldPoly = turf.polygon(oldTerritory.polygon.coordinates);
              
              if (turf.booleanIntersects(polygon, oldPoly) || turf.booleanIntersects(myCombinedGeometry, oldPoly)) {
                if (oldTerritory.userId.toString() === activity.userId.toString()) {
                  // Merge if same user
                  myCombinedGeometry = turf.union(turf.featureCollection([myCombinedGeometry, oldPoly]));
                  territoriesToDelete.push(oldTerritory._id);
                } else {
                  // Slice if other user
                  const difference = turf.difference(turf.featureCollection([oldPoly, polygon]));
                  if (!difference) {
                    territoriesToDelete.push(oldTerritory._id);
                  } else if (difference.geometry.type === 'Polygon' || difference.geometry.type === 'MultiPolygon') {
                    let newGeometry = difference.geometry;
                    
                    if (newGeometry.type === 'MultiPolygon') {
                       // Mongoose schema only supports 'Polygon' type currently, so keep the largest piece
                      let maxArea = 0;
                      let biggestPolyCoords = null;
                      newGeometry.coordinates.forEach(polyCoords => {
                        const p = turf.polygon(polyCoords);
                        const pArea = turf.area(p);
                        if (pArea > maxArea) {
                          maxArea = pArea;
                          biggestPolyCoords = polyCoords;
                        }
                      });
                      newGeometry = { type: 'Polygon', coordinates: biggestPolyCoords };
                    }
                    
                    const newArea = turf.area(turf.polygon(newGeometry.coordinates));
                    if (newArea < 10) { 
                      territoriesToDelete.push(oldTerritory._id);
                    } else {
                      oldTerritory.polygon = newGeometry;
                      oldTerritory.area = newArea;
                      await oldTerritory.save();
                    }
                  }
                }
              }
            } catch (geomErr) {
              console.error("Geometry Intersection Error:", geomErr);
            }
          }

          // Delete all merged or consumed territories
          for (const tId of territoriesToDelete) {
            await Territory.findByIdAndDelete(tId);
          }

          // 2. Save the new/merged Territory
          if (myCombinedGeometry.geometry.type === 'Polygon') {
            await Territory.create({
             userId: activity.userId,
             polygon: myCombinedGeometry.geometry,
             area: turf.area(myCombinedGeometry)
            });
          } else if (myCombinedGeometry.geometry.type === 'MultiPolygon') {
            // Save each disconnected sub-polygon as a separate territory record
            for (const polyCoords of myCombinedGeometry.geometry.coordinates) {
              const singlePoly = turf.polygon(polyCoords);
              await Territory.create({
               userId: activity.userId,
               polygon: singlePoly.geometry,
               area: turf.area(singlePoly)
              });
            }
          }
          
          // 3. Tell all clients to re-fetch
          const io = req.app.get('io');
          if (io) {
            io.emit('territoryUpdate');
          }
        }
       }
     }
    }
  } catch (turfErr) {
    console.error("Turf processing error during end activity:", turfErr);
    // Even if Turf fails, we STILL want to save the activity and shut it down below
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
  // Do not crash, ensure the user UI gets a response so it can close the tracker
  res.status(500).json({ error: err.message, message: "Tracker forced to stop" });
 }
};