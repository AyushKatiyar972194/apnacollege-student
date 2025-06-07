const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
// const ExpressError = require("../utils/ExpressError.js");
// const { listingSchema } = require("../schema.js");
const Listing = require("../models/listing.js");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const { fileSizeLimit } = require("../cloudConfig.js");
const {
  index,
  renderNewForm,
  showListings,
  createListings,
  renderEditForm,
  updateListings,
  deleteListings,
  filter,
  search
} = require("../controllers/listings.js");
const multer  = require('multer');
const {storage} = require("../cloudConfig.js")
const upload = multer({ storage });

// Search route
router.get("/search", wrapAsync(search));

// Filter route
router.get("/filter/:id", wrapAsync(filter));

// New route must come before /:id routes
router.get("/new", isLoggedIn, renderNewForm);

// Delete route must come before the /:id route to prevent conflicts
router.delete("/:id", isLoggedIn, isOwner, wrapAsync(deleteListings));

// Index and Create routes
router.route("/")
.get(wrapAsync(index))
.post(isLoggedIn, upload.single('listing[image]'), validateListing, wrapAsync(createListings));

// Show, Update, and Edit routes
router.route("/:id")
.get(wrapAsync(showListings))
.put(isLoggedIn, isOwner, upload.single('listing[image]'), validateListing, wrapAsync(updateListings));

router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(renderEditForm));

//New Route
router.get("/new", isLoggedIn, renderNewForm);
//Index Route
// await Listing.find({}).then ((res)=>{
//     console.log(res);
// });
// res.send("Hi, I am root");

//Create Route


//Edit Route


//Update Route


module.exports = router;
