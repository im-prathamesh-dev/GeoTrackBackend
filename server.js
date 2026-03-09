require ('dotenv').config ();
require("./config/passport");
const express = require ('express');
const http = require ('http');
const socketIo = require ('socket.io');
const passport = require("passport");
const jwt = require ('jsonwebtoken');
const cors = require ('cors');
const app = express ();
const server = http.createServer (app);
const Dbconnect = require ('./config/db');
const authRoutes = require("./routes/auth.routes");
const io = socketIo (server, {  
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});
const PORT = process.env.PORT || 5000;

// Middleware
app.use (express.json ());
app.use (cors ());
// MongoDB connection
Dbconnect();
//io connection
app.set('io', io);
app.use(passport.initialize());
io.on ('connection', (socket) => {
    console.log ('New client connected');
    socket.on ('disconnect', () => {
        console.log ('Client disconnected');
    });
});
// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/activity", require("./routes/activity.routes"));
app.use("/api/v1/user", require("./routes/user.routes"));
app.use("/api/v1/territory", require("./routes/territory.routes"));

// Start server
server.listen (PORT, () => {
    console.log (`Server running on port ${PORT}`);
});