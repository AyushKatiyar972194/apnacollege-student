const mongoose =require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");

const listingSchema = new Schema({
    title:{
        type:String,
        required:true,
    },
    description:String,
    image:{
        url:String,
        filename:String,
        // type:String,
        // default:"https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=1080&fit=max",
        // set: (v) => v==="" ? "https:/https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=1080&fit=max":v,
    },
    
    price:Number,
    location:String,
    country:String,
    reviews:[
        {
            type:Schema.Types.ObjectId,
            ref:"Review"
        }
       ],

     owner: {
      type:Schema.Types.ObjectId,
      ref:"User",
     },  

     geometry:{
      type:{
        type:String,
        enum:['Point'],
        required:true
      },
      coordinates:{
        type:[Number],
        required:true
      }
     },
     category:{
      type:Number,
     }
});

listingSchema.post("findOneAndDelete",async(listing)=>{
  if(listing){
    await Review.deleteMany({ _id:{$in: listing.reviews}});
  }
});

const Listing =mongoose.model("Listing", listingSchema);
module.exports =Listing;