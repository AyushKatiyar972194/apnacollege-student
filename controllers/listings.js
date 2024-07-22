const { query } = require("express");
const Listing = require("../models/listing.js");
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });
async function index(req, res) {
  const allListings = await Listing.find({});
  res.render("listings/index.ejs", { allListings });
}

function renderNewForm(req, res) {
  res.render("listings/new.ejs");
}

async function showListings(req, res) {
  let { id } = req.params;
  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");
  if (!listing) {
    req.flash("error", "Listing you requested does not exist!");
    res.redirect("/listings");
  }
  res.render("listings/show.ejs", { listing });
}

async function createListings(req, res, next) {
  let response = await geocodingClient
  .forwardGeocode({
    query:req.body.listing.location,
    limit:1,
  })
  .send();
  // console.log(response.body.features[0].geometry);
  // res.send("done!");

  let url = req.file.path;
  let filename = req.file.filename;
 
  // console.log(url,"..",filename);
  // let result = listingSchema.validate(req.body);
  // console.log(result);
  // if(result.error){
  //     throw new ExpressError(400,result.error);
  // }
  // if(!req.body.listing){
  //     throw new ExpressError(400,"Send valid data for listing");
  // };
  // try{
  const newListing = new Listing(req.body.listing);
  // if(!newListing.title){
  //     throw new ExpressError(400,"Title is missing");
  // }
  // if(!newListing.description){
  //     throw new ExpressError(400,"Description is missing");
  // }
  // if(!newListing.location){
  //     throw new ExpressError(400,"Location is missing");
  // }
  newListing.owner = req.user._id;
  newListing.image = {url,filename};
  newListing.geometry = response.body.features[0].geometry;
  let savedListing =await newListing.save();
  console.log(savedListing);
  await newListing.save();
  req.flash("success", "New Listing Created!");

  // console.log(listing);
  res.redirect("/listings");
  // } catch(err){
  //     next(err);
  // }
  // let {title, description, image, price, country, location}=req.body;
  // let listing = req.body.listing;
  // new Listing(listing);
  //                 ||
  // new Listing(req.body.listing);
}

async function renderEditForm(req, res) {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing you requested does not exist!");
    res.redirect("/listings");
  }



  let originalImageUrl = listing.image.url;
  originalImageUrl=originalImageUrl.replace("/upload","/upload/w_250");
  res.render("listings/edit.ejs", { listing,originalImageUrl});
}

async function updateListings(req, res) {
  let { id } = req.params;
  // let listing = Listing.findById(id);
  // if(!listing.owner.equals(res.locals.currUser._id)){
  //     req.flash("error","You don't have permission to edit");
  // return  res.redirect(`/listings/${id}`);
  // }
  let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });
  if(typeof req.file!=="undefined"){
    let url = req.file.path;
    let filename = req.file.filename;
    listing.image = {url,filename};
    await listing.save();
  }
  
  req.flash("success", "Listing Updated!");
  res.redirect(`/listings/${id}`);
}

async function deleteListings(req, res) {
  let { id } = req.params;
  let deletedListing = await Listing.findByIdAndDelete(id);
  console.log(deletedListing);
  req.flash("success", "Listing Deleted!");

  res.redirect("/listings");
}

module.exports = {
  index,
  renderNewForm,
  showListings,
  createListings,
  renderEditForm,
  updateListings,
  deleteListings,
  filter,
  search 
};

 async function filter(req,res,next){
  // let {q} = req.query;
  let {id} = req.params;
  let allListings = await Listing.find({category: id});
  // console.log(allListing)
  if(allListings.length != 0){
      res.render("listings/index.ejs", { allListings });
  }else{
      req.flash("error","Listings is not here")
      res.redirect("/listings")
  }
}

 async function search(req, res) {
  let { title } = req.query;

  const allListings = await Listing.find({ title });
  res.render("./listings/index.ejs", { allListings });
};