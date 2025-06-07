if(process.env.NODE_ENV !="production"){
    require("dotenv").config();
}
const express= require("express");
const app= express();
const mongoose = require("mongoose");
// const Listing= require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const engine =require("ejs-mate");
// const wrapAsync=require("./utils/wrapAsync.js");
const ExpressError=require("./utils/ExpressError.js");
// // const {listingSchema,reviewSchema}= require("./schema.js");
// const Review= require("./models/review.js");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const reservationRouter = require("./routes/reservation.js");
const { options } = require("joi");


app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(methodOverride("_method"));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));
app.engine("ejs", engine);

app.use(express.static(path.join(__dirname,"/public")));

// const MONGO_URL ="mongodb://127.0.0.1:27017/fortunevila";
const dbUrl = process.env.ATLASDB_URL;
main()
.then(()=>{
    console.log("connected to DB");
})
.catch((err)=>{
    console.log(err);
});
async function main() {
    await mongoose.connect(dbUrl);
}


// app.get("/testlisting", async (req,res)=>{
//     let sampleListing =new Listing({
//         title: "my New Villa",
//         description:"By the beach",
//         price:1200,
//         location:"Calangute,Goa",
//         country:"India",
//     });
//     await sampleListing.save();
//     console.log("sample was saved");
//     res.send("successful testing");
// });

// app.get("/",(req,res)=>{
//     res.send("Hi, I am root");
// });

const store = MongoStore.create({
    mongoUrl:dbUrl,
    crypto:{
        secret:process.env.SECRET,
    },
    touchAfter:24 * 3600,
});

const sessionOptions = {
    store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' // good default for cross-site login (e.g., Google)
    }
};

// app.get("/",(req,res)=>{
//     res.redirect("/listings");
// });
app.set('trust proxy', 1); // Trust Render’s proxy
app.use(session(sessionOptions));
app.use(flash());

// Initialize passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Configure passport
passport.use(new LocalStrategy(User.authenticate()));

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    proxy: true
  },
  async function(accessToken, refreshToken, profile, done) {
    try {
      console.log('Google OAuth strategy - Profile:', {
        id: profile.id,
        email: profile.emails?.[0]?.value,
        name: profile.displayName
      });

      // Find or create user
      const email = profile.emails[0].value;
      let user = await User.findOne({ 
        $or: [
          { email: email },
          { googleId: profile.id }
        ]
      });

      if (!user) {
        // Create new user
        const name = {
          givenName: profile.name?.givenName || profile.displayName?.split(' ')[0] || null,
          familyName: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || null
        };

        user = new User({
          email: email,
          googleId: profile.id,
          name: name,
          username: profile.displayName || email.split('@')[0],
          isVerified: true // Google OAuth users are pre-verified
        });

        await user.save();
        console.log('Created new user for Google OAuth:', { 
          userId: user._id, 
          email: user.email,
          name: user.name,
          username: user.username,
          googleId: user.googleId
        });
      } else {
        // Update existing user with Google ID if not set
        if (!user.googleId) {
          user.googleId = profile.id;
        }
        if (!user.name?.givenName && profile.name?.givenName) {
          user.name = user.name || {};
          user.name.givenName = profile.name.givenName;
        }
        if (!user.name?.familyName && profile.name?.familyName) {
          user.name = user.name || {};
          user.name.familyName = profile.name.familyName;
        }
        if (!user.username && profile.displayName) {
          user.username = profile.displayName;
        }
        await user.save();
        console.log('Updated existing user with Google data:', {
          userId: user._id,
          email: user.email,
          name: user.name,
          username: user.username,
          googleId: user.googleId
        });
      }

      // Ensure we're passing a proper user object to done()
      if (!user._id) {
        console.error('User object missing _id:', user);
        return done(new Error('Invalid user object created'));
      }

      return done(null, user);
    } catch (err) {
      console.error('Error in Google OAuth strategy:', err);
      return done(err);
    }
  }
));

// Serialize user - store only the MongoDB _id in the session
passport.serializeUser((user, done) => {
  try {
    // Ensure we have a valid user object with _id
    if (!user || !user._id) {
      console.error('Invalid user object during serialization:', user);
      return done(new Error('Invalid user object'));
    }
    
    // Store only the _id in the session
    const userId = user._id.toString();
    console.log('Serializing user:', { userId });
    done(null, userId);
  } catch (err) {
    console.error('Error serializing user:', err);
    done(err);
  }
});

// Deserialize user - retrieve user from database using _id
passport.deserializeUser(async (id, done) => {
  try {
    // Ensure we have a valid MongoDB ObjectId
    if (!id || typeof id !== 'string') {
      console.error('Invalid user id during deserialization:', id);
      return done(null, false);
    }

    console.log('Deserializing user with id:', id);
    const user = await User.findById(id);
    
    if (!user) {
      console.log('User not found during deserialization');
      return done(null, false);
    }
    
    console.log('Deserialized user:', { 
      userId: user._id, 
      email: user.email,
      username: user.username 
    });
    
    done(null, user);
  } catch (err) {
    console.error('Error deserializing user:', err);
    done(err);
  }
});

// Make user available to all templates
app.use((req, res, next) => {
    // Set flash messages
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    
    // Set current user - ensure it's always available
    res.locals.currUser = req.user || null;
    
    // Log user state for debugging
    console.log('User state in middleware:', {
        isAuthenticated: req.isAuthenticated(),
        userId: req.user?._id,
        username: req.user?.username,
        email: req.user?.email
    });
    
    next();
});

// app.get("/demouser",async (req,res)=>{
//     let fakeUser = new User({
//         email:"student@gmail.com",
//         username:"delta-student",
//     });

//     let registeredUser = await User.register(fakeUser,"helloworld");
//     res.send(registeredUser);
// });

// Google Auth Routes
app.get('/auth/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/login',
    failureFlash: true
  }),
  (req, res) => {
    console.log('Google OAuth callback - User:', req.user);
    console.log('Google OAuth callback - Is authenticated:', req.isAuthenticated());
    
    // Get the redirect URL from session or default to listings
    const redirectUrl = req.session.redirectUrl || '/listings';
    delete req.session.redirectUrl; // Clear the stored URL
    
    req.flash('success', 'Welcome to FortuneVila!');
    res.redirect(redirectUrl);
  }
);

// Mount routes in the correct order
console.log('Mounting routes...');

app.use("/listings", listingRouter);
console.log('Listings router mounted');

app.use("/listings/:id/reviews", reviewRouter);
console.log('Reviews router mounted');

app.use("/reservations", reservationRouter);
console.log('Reservations router mounted');

app.use("/", userRouter);
console.log('User router mounted');

// Catch-all route for 404s - must be after all other routes
app.all("*", (req, res, next) => {
    console.log('404 route hit:', req.method, req.originalUrl);
    next(new ExpressError(404, "Page Not Found!"));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.log('Error middleware hit:', err);
    let { statusCode = 500, message = "something went wrong!" } = err;
    res.status(statusCode).render("listings/error.ejs", { message });
});

app.listen(8080,()=>{
    console.log("Server is listening to port 8080");
});