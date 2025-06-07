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
router.post("/:id/cancel", isLoggedIn, async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const reservationId = req.params.id;
        
        const reservation = await Reservation.findById(reservationId);
        
        if (!reservation) {
            return res.status(404).json({
                success: false,
                error: 'Reservation not found'
            });
        }

        // Check if user owns the reservation
        if (!reservation.user.equals(req.user._id)) {
            return res.status(403).json({
                success: false,
                error: 'You don\'t have permission to cancel this reservation'
            });
        }

        // Calculate cancellation details
        const bookingTime = new Date(reservation.createdAt);
        const now = new Date();
        const hoursSinceBooking = (now - bookingTime) / (1000 * 60 * 60);
        
        let cancellationFee = 0;
        let refundAmount = 0;
        let cancellationReason = '';
        
        if (hoursSinceBooking <= 1) {
            // Free cancellation within 1 hour
            refundAmount = reservation.totalPrice;
            cancellationReason = 'Free cancellation within 1 hour of booking';
        } else {
            // No refund after 1 hour
            cancellationFee = reservation.totalPrice;
            cancellationReason = 'Cancellation after 1 hour of booking - No refund';
        }

        // Update reservation status
        reservation.status = 'cancelled';
        await reservation.save();

        res.json({
            success: true,
            message: 'Reservation cancelled successfully',
            cancellationReason,
            refundAmount,
            cancellationFee,
            refundStatus: refundAmount > 0 ? 'pending' : 'none'
        });
    } catch (error) {
        console.error('Error in cancel route:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to cancel reservation'
        });
    }
});

console.log('Reservation router loaded successfully');

module.exports = router; 