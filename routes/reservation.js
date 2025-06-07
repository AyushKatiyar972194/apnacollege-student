const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware");
const {
    createReservation,
    verifyPayment,
    handleSuccess,
    handleFailure,
    getUserReservations,
    renderReservationForm,
    cancelReservation
} = require("../controllers/reservations");
const Reservation = require("../models/reservation");

console.log('Loading reservation router...');

// Debug middleware to log all requests
router.use((req, res, next) => {
    console.log('Reservation Route:', req.method, req.originalUrl);
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    console.log('Request user:', req.user);
    next();
});

// Test route to verify router is working
router.get('/test', (req, res) => {
    console.log('Test route hit');
    res.json({ message: 'Reservation router is working' });
});

// Render reservation form
router.get("/new/:id", isLoggedIn, renderReservationForm);

// Create a new reservation
router.post("/", isLoggedIn, createReservation);

// Get user's reservations
router.get("/my-reservations", isLoggedIn, getUserReservations);

// Verify Razorpay payment
router.post("/verify-payment", isLoggedIn, verifyPayment);

// Handle successful payment
router.get("/success", isLoggedIn, handleSuccess);

// Handle failed payment
router.get("/failed", isLoggedIn, handleFailure);

// Cancel a reservation - Make sure this route is before any other routes with :id parameter
router.post("/:id/cancel", isLoggedIn, cancelReservation);

console.log('Reservation router loaded successfully');

module.exports = router; 