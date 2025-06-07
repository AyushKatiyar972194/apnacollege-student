const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    username: {
        type: String,
        trim: true
    },
    name: {
        givenName: String,
        familyName: String
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    resetPasswordToken: String,
    resetPasswordExpires: Date
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
    if (this.name) {
        return `${this.name.givenName || ''} ${this.name.familyName || ''}`.trim();
    }
    return this.username || 'User';
});

// Virtual for display name
userSchema.virtual('displayName').get(function() {
    return this.username || this.fullName || this.email.split('@')[0];
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);