const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

const callbackURL =
  process.env.GOOGLE_CALLBACK_URL ||
  `${process.env.SERVER_URL || "http://localhost:5000"}/api/v1/auth/google/callback`;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {

        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          user = await User.create({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            profilePic: profile.photos[0].value,
            color: "#" + Math.floor(Math.random() * 16777215).toString(16)
          });
        } else {
          // Keep profile picture and name synced
          user.profilePic = profile.photos[0].value;
          user.name = profile.displayName;
          await user.save();
        }

        return done(null, user);

      } catch (error) {
        return done(error, null);
      }
    }
  )
);