const Razorpay = require('razorpay');
const crypto = require('crypto');
const Reservation = require("../models/reservation");
const Listing = require("../models/listing");
const moment = require("moment");

// Initialize Razorpay with test credentials
const razorpay = new Razorpay({
    key_id: 'rzp_test_gi3G6jtIqXNtxv',
    key_secret: '42XoKl8QCuC2SydGtN5lBBv1'
});

// Create a new reservation and Razorpay order
async function createReservation(req, res) {
    try {
        // Check if user is logged in
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Please login to make a reservation'
            });
        }

        const { listingId, checkIn, checkOut, numberOfGuests, totalPrice } = req.body;

        // Create reservation in pending state
        const reservation = new Reservation({
            listing: listingId,
            user: req.user._id,
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            numberOfGuests,
            totalPrice,
            status: 'pending'
        });

        await reservation.save();

        // Create Razorpay order
        const options = {
            amount: Math.round(totalPrice * 100), // Convert to paise
            currency: "INR",
            receipt: reservation._id.toString(),
            notes: {
                listingId,
                userId: req.user._id.toString()
            }
        };

        const order = await razorpay.orders.create(options);

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            reservationId: reservation._id
        });
    } catch (error) {
        console.error('Error creating reservation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create reservation'
        });
    }
}

// Verify Razorpay payment
async function verifyPayment(req, res) {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            reservationId
        } = req.body;

        // Verify signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", '42XoKl8QCuC2SydGtN5lBBv1')
            .update(body.toString())
            .digest("hex");

        const isAuthentic = expectedSignature === razorpay_signature;

        if (isAuthentic) {
            // Update reservation status
            await Reservation.findByIdAndUpdate(reservationId, {
                status: 'confirmed',
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id
            });

            res.json({
                success: true,
                message: 'Payment verified successfully'
            });
        } else {
            await Reservation.findByIdAndUpdate(reservationId, {
                status: 'failed'
            });

            res.json({
                success: false,
                error: 'Payment verification failed'
            });
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify payment'
        });
    }
}

// Handle successful payment
async function handleSuccess(req, res) {
    try {
        const { reservationId } = req.query;
        const reservation = await Reservation.findById(reservationId)
            .populate('listing')
            .populate('user');

        if (!reservation) {
            req.flash('error', 'Reservation not found');
            return res.redirect('/listings');
        }

        res.render('reservations/success.ejs', { reservation });
    } catch (error) {
        console.error('Error handling success:', error);
        req.flash('error', 'Something went wrong');
        res.redirect('/listings');
    }
}

// Handle failed payment
async function handleFailure(req, res) {
    try {
        const { reservationId } = req.query;
        await Reservation.findByIdAndUpdate(reservationId, { status: 'failed' });

        req.flash('error', 'Payment failed. Please try again.');
        res.redirect('/listings');
    } catch (error) {
        console.error('Error handling failure:', error);
        req.flash('error', 'Something went wrong');
        res.redirect('/listings');
    }
}

// Get user's reservations
async function getUserReservations(req, res) {
    try {
        const reservations = await Reservation.find({ user: req.user._id })
            .populate("listing")
            .sort("-createdAt");
        res.render("reservations/index.ejs", { reservations });
    } catch (error) {
        console.error("Get reservations error:", error);
        req.flash("error", "Failed to fetch reservations");
        res.redirect("/listings");
    }
}

// Render reservation form
async function renderReservationForm(req, res) {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            req.flash("error", "Listing not found");
            return res.redirect("/listings");
        }
        res.render("reservations/new.ejs", { listing });
    } catch (error) {
        console.error("Error rendering reservation form:", error);
        req.flash("error", "Error loading reservation form");
        res.redirect("/listings");
    }
}

// Cancel a reservation
async function cancelReservation(req, res) {
    try {
        const reservation = await Reservation.findById(req.params.id);
        
        if (!reservation) {
            req.flash("error", "Reservation not found");
            return res.redirect("/reservations/my-reservations");
        }

        // Check if user owns the reservation
        if (!reservation.user.equals(req.user._id)) {
            req.flash("error", "You don't have permission to cancel this reservation");
            return res.redirect("/reservations/my-reservations");
        }

        // Update reservation status
        reservation.status = 'cancelled';
        await reservation.save();

        req.flash("success", "Reservation cancelled successfully");
        res.redirect("/reservations/my-reservations");
    } catch (error) {
        console.error("Error cancelling reservation:", error);
        req.flash("error", "Failed to cancel reservation");
        res.redirect("/reservations/my-reservations");
    }
}

module.exports = {
    createReservation,
    verifyPayment,
    handleSuccess,
    handleFailure,
    getUserReservations,
    renderReservationForm,
    cancelReservation
}; 