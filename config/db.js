require('dotenv').config();
const mongoose = require('mongoose');

const Dbconnect = async ()=>{
    try{
            await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');
    }
    catch(err){
        console.log(err.message);
        process.exit(1);
    }


}
module.exports = Dbconnect;