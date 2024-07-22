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

router.get("/filter/:id",wrapAsync(filter));
router.get("/search", wrapAsync(search));

router.route("/")
.get( wrapAsync(index))
.post( isLoggedIn,upload.single('listing[image]'),validateListing, wrapAsync(createListings));
// .post(,(req,res)=>{
//   res.send(req.file);
// });

//New Route
router.get("/new", isLoggedIn, renderNewForm);
//Index Route
// await Listing.find({}).then ((res)=>{
//     console.log(res);
// });
// res.send("Hi, I am root");
router.route("/:id")
.get( wrapAsync(showListings))
.put(
  isLoggedIn,
  isOwner,
  upload.single('listing[image]'),
  validateListing,
  wrapAsync(updateListings)
)
.delete(isLoggedIn, isOwner, wrapAsync(deleteListings));
//Show Route


//Create Route


//Edit Route
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(renderEditForm));

//Update Route


// Delete Route


module.exports = router;
