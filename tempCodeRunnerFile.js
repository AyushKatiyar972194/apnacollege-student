await Listing.find({}).then ((res)=>{
        console.log(res);
    });
    res.send("Hi, I am root");