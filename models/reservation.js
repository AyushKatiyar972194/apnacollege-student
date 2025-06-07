const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema({
    listing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Listing",
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    checkIn: {
        type: Date,
        required: true
    },
    checkOut: {
        type: Date,
        required: true
    },
    numberOfGuests: {
        type: Number,
        required: true,
        min: 1
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ["pending", "confirmed", "failed", "cancelled"],
        default: "pending"
    },
    paymentId: {
        type: String
    },
    orderId: {
        type: String
    },
    cancelledAt: {
        type: Date
    },
    refundAmount: {
        type: Number,
        default: 0
    },
    cancellationFee: {
        type: Number,
        default: 0
    },
    cancellationReason: {
        type: String
    },
    refundId: {
        type: String
    },
    refundStatus: {
        type: String,
        enum: ["pending", "processed", "failed", "not_applicable"],
        default: "not_applicable"
    },
    refundError: {
        type: String
    }
}, {
    timestamps: true
});

const Reservation = mongoose.model("Reservation", reservationSchema);
module.exports = Reservation; 