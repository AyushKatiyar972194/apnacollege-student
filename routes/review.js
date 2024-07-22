const express = require("express");
const router = express.Router({ mergeParams: true });
const Listing = require("../models/listing.js");
const wrapAsync = require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
// const {reviewSchema}= require("../schema.js");
const Review = require("../models/review.js");
const {
  validateReview,
  isLoggedIn,
  isReviewAuthor,
} = require("../middleware.js");

const { createReview, deleteReview } = require("../controllers/reviews.js");

//Reviews-> Post Review Route
router.post(
  "/",
  validateReview,
  isLoggedIn,
  wrapAsync(createReview));

//Delete Review Route
router.delete(
  "/:reviewId",isLoggedIn,
  isReviewAuthor,
  wrapAsync(deleteReview));

module.exports = router;
