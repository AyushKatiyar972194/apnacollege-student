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
    resave: true,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
};

// app.get("/",(req,res)=>{
//     res.redirect("/listings");
// });

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
    callbackURL: "/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // For now, just pass the profile as the user object
    return done(null, profile);
  }
));

passport.serializeUser(function(user, done) {
  // For Google, serialize the whole profile
  done(null, user);
});
passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

// Make user available to all templates
app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    // Add this line to ensure user is available in all requests
    req.user = req.user || null;
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
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', failureFlash: true }),
  function(req, res) {
    // Successful authentication, redirect to listings.
    res.redirect('/listings');
  }
);

app.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/listings');
  });
});

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