const mongoose = require("mongoose");

const territorySchema = new mongoose.Schema({

 userId:{
  type:mongoose.Schema.Types.ObjectId,
  ref:"User"
 },

 polygon:{
  type:{
   type:String,
   enum:["Polygon"]
  },
  coordinates:[[[Number]]]
 },

 area:Number,
 createdAt:{
  type:Date,
  default:Date.now
 }

});

territorySchema.index({polygon:"2dsphere"});

module.exports = mongoose.model("Territory",territorySchema);