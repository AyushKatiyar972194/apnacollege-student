const Listing = require("./models/listing.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema } = require("./schema.js");
const {reviewSchema}= require("./schema.js");
const Review= require("./models/review.js");

module.exports.isLoggedIn = (req, res, next) => {
    // Check if user is authenticated
    if (!req.isAuthenticated()) {
        // Check if it's an AJAX request or API call
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        
        // For regular page requests
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in to FortuneVila!");
        return res.redirect("/login");
    }
    
    // Ensure user object is available
    if (!req.user) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({
                success: false,
                error: 'User session expired'
            });
        }
        req.flash("error", "Your session has expired. Please log in again.");
        return res.redirect("/login");
    }
    
    next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
    console.log('saveRedirectUrl middleware - Session:', req.session);
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
        console.log('Saved redirect URL:', req.session.redirectUrl);
    }
    next();
};

module.exports.isOwner = async (req,res, next)=>{
    let { id } = req.params;
    let listing = await Listing.findById(id);
    if(!listing.owner.equals(res.locals.currUser._id)){
        req.flash("error","You are not the owner of this listing");
    return  res.redirect(`/listings/${id}`);
    }
    next()
 };

 module.exports.validateListing = async (req,res, next)=>{
//  const validateListing = (req, res, next) => {
    let { error } = listingSchema.validate(req.body);
    if (error) {
      let errMsg = error.details.map((el) => el.message).join(",");
      throw new ExpressError(400, errMsg);
    } else {
      next();
    }
//   };
};
module.exports.validateReview = async (req,res, next)=>{

// const validateReview = (req,res,next)=>{
    // console.log(req.params.id);
    let {error} = reviewSchema.validate(req.body);
    if(error){
        let errMsg = error.details.map((el)=>el.message).join(",");
        throw new ExpressError(400,errMsg);
    }else{
        next();
    }
// }
};

module.exports.isReviewAuthor = async (req,res, next)=>{
    let { id,reviewId } = req.params;
    let review = await Review.findById(reviewId);
    if(!review.author.equals(res.locals.currUser._id)){
        req.flash("error","You are not the author of this review");
    return  res.redirect(`/listings/${id}`);
    }
    next()
 };