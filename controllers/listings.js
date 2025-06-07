const { query } = require("express");
const Listing = require("../models/listing.js");
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
console.log("Mapbox Token:", mapToken ? "Token exists" : "Token is missing");
const geocodingClient = mbxGeocoding({ accessToken: mapToken });
async function index(req, res) {
  const allListings = await Listing.find({});
  res.render("listings/index.ejs", { allListings });
}

function renderNewForm(req, res) {
  res.render("listings/new.ejs");
}

async function showListings(req, res) {
  try {
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
      return res.redirect("/listings");
    }

    // Ensure mapToken is available
    const mapToken = process.env.MAP_TOKEN;
    if (!mapToken) {
      console.error("MAP_TOKEN environment variable is not defined");
      req.flash("error", "Map configuration error");
      return res.redirect("/listings");
    }

    // Validate geometry data
    if (!listing.geometry || !listing.geometry.coordinates || !Array.isArray(listing.geometry.coordinates)) {
      console.error("Invalid geometry data for listing:", id);
      // Set default coordinates (you can adjust these as needed)
      listing.geometry = {
        type: "Point",
        coordinates: [80.9462, 26.8467] // Default coordinates for Lucknow
      };
    }

    res.render("listings/show.ejs", { listing, mapToken });
  } catch (error) {
    console.error("Error showing listing:", error);
    req.flash("error", "Error loading listing");
    res.redirect("/listings");
  }
}

async function createListings(req, res, next) {
  try {
    // Geocode the location
    let response = await geocodingClient
      .forwardGeocode({
        query: req.body.listing.location,
        limit: 1,
      })
      .send();

    // Validate geocoding response
    if (!response.body.features.length) {
      req.flash("error", "Could not find coordinates for the specified location");
      return res.redirect("/listings/new");
    }

    // Get image data
    let url = req.file.path;
    let filename = req.file.filename;

    // Create new listing
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image = { url, filename };

    // Set geometry data
    const [lng, lat] = response.body.features[0].geometry.coordinates;
    newListing.geometry = {
      type: "Point",
      coordinates: [lng, lat]
    };

    // Save listing
    await newListing.save();
    console.log("Created listing with geometry:", newListing.geometry);
    
    req.flash("success", "New Listing Created!");
    res.redirect("/listings");
  } catch (err) {
    console.error("Error creating listing:", err);
    req.flash("error", "Error creating listing");
    res.redirect("/listings/new");
  }
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
  try {
    let { id } = req.params;
    let listing = await Listing.findById(id);
    
    if (!listing) {
      req.flash("error", "Listing not found");
      return res.redirect("/listings");
    }

    // Update listing fields while preserving owner
    const updateData = { ...req.body.listing };
    delete updateData.owner; // Ensure owner field is not overwritten
    
    // Update the listing
    Object.assign(listing, updateData);
    
    // Handle image update if present
    if (req.file) {
      let url = req.file.path;
      let filename = req.file.filename;
      listing.image = { url, filename };
    }
    
    await listing.save();
    req.flash("success", "Listing Updated!");
    res.redirect(`/listings/${id}`);
  } catch (error) {
    console.error("Error updating listing:", error);
    req.flash("error", "Error updating listing");
    res.redirect(`/listings/${id}`);
  }
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
  
  if (!title) {
    req.flash("error", "Please enter a search term");
    return res.redirect("/listings");
  }

  try {
    // Create a case-insensitive regex pattern for partial matches
    const searchPattern = new RegExp(title, 'i');
    
    const allListings = await Listing.find({
      $or: [
        { title: searchPattern },
        { location: searchPattern },
        { country: searchPattern }
      ]
    });

    if (allListings.length === 0) {
      req.flash("error", "No listings found matching your search");
      return res.redirect("/listings");
    }

    res.render("listings/index.ejs", { allListings });
  } catch (error) {
    console.error("Search error:", error);
    req.flash("error", "An error occurred while searching");
    res.redirect("/listings");
  }
}