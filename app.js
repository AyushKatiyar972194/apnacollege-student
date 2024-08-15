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

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const { options } = require("joi");
const axios = require('axios'); //Installed Axios- npm install axios For Hack of render reload

app.use(express.urlencoded({extended: true}));
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

const sessionOptions ={
    store,
    secret:process.env.SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        expires:Date.now()+1000*60*60*24*7,
        maxAge:1000*60*60*24*7,
        httponly:true
    },
};

// app.get("/",(req,res)=>{
//     res.redirect("/listings");
// });

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next)=>{
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
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

// Below Hack for render slow down problem 
const url = `https://apnacollege-student.onrender.com`; // Replace with your Render URL
const interval = 30000; // Interval in milliseconds (30 seconds)

function reloadWebsite() {
  axios.get(url)
    .then(response => {
      console.log(`Reloaded at ${new Date().toISOString()}: Status Code ${response.status}`);
    })
    .catch(error => {
      console.error(`Error reloading at ${new Date().toISOString()}:`, error.message);
    });
}


setInterval(reloadWebsite, interval);
// Above Hack for render slow down problem 
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews",reviewRouter)
app.use("/",userRouter);

app.all("*",(req,res,next)=>{
    next(new ExpressError(404,"Page Not Found!"));
});

app.use((err,req,res,next)=>{
    let{statusCode=500,message="something went wrong!"}=err;
    res.status(statusCode).render("listings/error.ejs",{message});
    //err
    // res.status(statusCode).send(message);
    // res.send("something went wrong");
});

app.listen(8080,()=>{
    console.log("Server is listening to port 8080");
});