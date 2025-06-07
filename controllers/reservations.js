const Razorpay = require('razorpay');
const crypto = require('crypto');
const Reservation = require("../models/reservation");
const Listing = require("../models/listing");
const User = require("../models/user");
const moment = require("moment");

// Helper function to get or create user from Google OAuth data or regular user
async function getOrCreateUser(user) {
    try {
        // If it's a regular user from the session
        if (user._id) {
            const dbUser = await User.findById(user._id);
            if (!dbUser) {
                throw new Error('User not found in database');
            }
            return dbUser;
        }

        // If it's a Google OAuth user
        if (user.emails && user.emails[0]) {
            const email = user.emails[0].value;
            let dbUser = await User.findOne({ 
                $or: [
                    { email: email },
                    { googleId: user.id }
                ]
            });

            if (!dbUser) {
                // Parse name from Google profile
                const name = {
                    givenName: user.name?.givenName || user.displayName?.split(' ')[0] || null,
                    familyName: user.name?.familyName || user.displayName?.split(' ').slice(1).join(' ') || null
                };

                dbUser = new User({
                    email: email,
                    googleId: user.id,
                    name: name,
                    username: user.displayName || email.split('@')[0],
                    isVerified: true // Google OAuth users are pre-verified
                });
                await dbUser.save();
                console.log('Created new user for Google OAuth:', { 
                    userId: dbUser._id, 
                    email: dbUser.email,
                    name: dbUser.name,
                    username: dbUser.username,
                    googleId: dbUser.googleId
                });
            } else {
                // Update existing user with Google ID if not set
                dbUser.googleId = user.id;
                if (!dbUser.name.givenName && user.name?.givenName) {
                    dbUser.name.givenName = user.name.givenName;
                }
                if (!dbUser.name.familyName && user.name?.familyName) {
                    dbUser.name.familyName = user.name.familyName;
                }
                if (!dbUser.username && user.displayName) {
                    dbUser.username = user.displayName;
                }
                await dbUser.save();
                console.log('Updated existing user with Google data:', {
                    userId: dbUser._id,
                    email: dbUser.email,
                    name: dbUser.name,
                    username: dbUser.username,
                    googleId: dbUser.googleId
                });
            }
            return dbUser;
        }

        throw new Error('Invalid user data');
    } catch (error) {
        console.error('Error in getOrCreateUser:', {
            error: error.message,
            user: user ? {
                id: user.id || user._id,
                email: user.email || user.emails?.[0]?.value,
                name: user.name || user.displayName
            } : 'no user data'
        });
        throw error;
    }
}

// Initialize Razorpay with environment variables
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Validate dates
function validateDates(checkIn, checkOut) {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(today.getFullYear() + 1); // Max 1 year in future

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        return { valid: false, error: 'Invalid date format' };
    }

    if (checkInDate < today) {
        return { valid: false, error: 'Check-in date cannot be in the past' };
    }

    if (checkOutDate <= checkInDate) {
        return { valid: false, error: 'Check-out date must be after check-in date' };
    }

    if (checkInDate > maxFutureDate) {
        return { valid: false, error: 'Check-in date cannot be more than 1 year in the future' };
    }

    if (checkOutDate > maxFutureDate) {
        return { valid: false, error: 'Check-out date cannot be more than 1 year in the future' };
    }

    return { 
        valid: true,
        checkInDate,
        checkOutDate
    };
}

// Create a new reservation and Razorpay order
async function createReservation(req, res) {
    try {
        console.log('Creating reservation with data:', {
            body: req.body,
            user: req.user ? { 
                id: req.user.id || req.user._id, 
                email: req.user.email || req.user.emails?.[0]?.value 
            } : 'not logged in'
        });

        // Check if user is logged in
        if (!req.user) {
            console.log('Authentication error: User not logged in');
            return res.status(401).json({
                success: false,
                error: 'Please login to make a reservation'
            });
        }

        // Use the authenticated user directly since they're already in the database
        const dbUser = req.user;

        const { listingId, checkIn, checkOut, numberOfGuests, totalPrice } = req.body;

        // Validate required fields
        if (!listingId || !checkIn || !checkOut || !numberOfGuests || !totalPrice) {
            console.log('Validation error: Missing required fields', { 
                listingId, 
                checkIn, 
                checkOut, 
                numberOfGuests, 
                totalPrice,
                hasListingId: !!listingId,
                hasCheckIn: !!checkIn,
                hasCheckOut: !!checkOut,
                hasNumberOfGuests: !!numberOfGuests,
                hasTotalPrice: !!totalPrice
            });
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Validate dates with new function
        const dateValidation = validateDates(checkIn, checkOut);
        if (!dateValidation.valid) {
            console.log('Validation error:', dateValidation.error);
            return res.status(400).json({
                success: false,
                error: dateValidation.error
            });
        }

        // Check if listing exists
        const listing = await Listing.findById(listingId);
        if (!listing) {
            console.log('Validation error: Listing not found', { listingId });
            return res.status(404).json({
                success: false,
                error: 'Listing not found'
            });
        }

        // Create reservation in pending state
        const reservation = new Reservation({
            listing: listingId,
            user: dbUser._id, // Use the MongoDB user ID
            checkIn: dateValidation.checkInDate,
            checkOut: dateValidation.checkOutDate,
            numberOfGuests: parseInt(numberOfGuests),
            totalPrice: parseFloat(totalPrice),
            status: 'pending'
        });

        try {
            await reservation.save();
            console.log('Reservation saved successfully:', { 
                reservationId: reservation._id,
                userId: dbUser._id,
                email: dbUser.email,
                checkIn: dateValidation.checkInDate,
                checkOut: dateValidation.checkOutDate
            });
        } catch (dbError) {
            console.error('Database error while saving reservation:', {
                error: dbError,
                code: dbError.code,
                message: dbError.message,
                validationErrors: dbError.errors,
                userId: dbUser._id,
                reservationData: {
                    listing: listingId,
                    user: dbUser._id,
                    checkIn: dateValidation.checkInDate,
                    checkOut: dateValidation.checkOutDate,
                    numberOfGuests,
                    totalPrice
                }
            });
            return res.status(500).json({
                success: false,
                error: 'Failed to save reservation to database'
            });
        }

        // Create Razorpay order with additional validation
        if (totalPrice <= 0) {
            console.log('Validation error: Invalid total price', { totalPrice });
            return res.status(400).json({
                success: false,
                error: 'Invalid total price'
            });
        }

        const options = {
            amount: Math.round(totalPrice * 100), // Convert to paise
            currency: "INR",
            receipt: reservation._id.toString(),
            notes: {
                listingId,
                userId: dbUser._id.toString(),
                checkIn: dateValidation.checkInDate.toISOString(),
                checkOut: dateValidation.checkOutDate.toISOString()
            }
        };

        try {
            console.log('Creating Razorpay order with options:', options);
            const order = await razorpay.orders.create(options);
            console.log('Razorpay order created successfully:', { orderId: order.id });
            
            res.json({
                success: true,
                orderId: order.id,
                amount: order.amount,
                reservationId: reservation._id
            });
        } catch (razorpayError) {
            console.error('Razorpay error:', {
                error: razorpayError,
                message: razorpayError.message,
                code: razorpayError.code
            });
            // Clean up the reservation if Razorpay order creation fails
            await Reservation.findByIdAndDelete(reservation._id);
            return res.status(500).json({
                success: false,
                error: 'Failed to create payment order'
            });
        }
    } catch (error) {
        console.error('Error creating reservation:', {
            message: error.message,
            stack: error.stack,
            body: req.body,
            user: req.user ? { 
                id: req.user.id,
                email: req.user.emails?.[0]?.value
            } : 'not logged in'
        });
        res.status(500).json({
            success: false,
            error: 'Failed to create reservation'
        });
    }
}

// Verify Razorpay payment with enhanced security
async function verifyPayment(req, res) {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            reservationId
        } = req.body;

        // Validate required fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !reservationId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required payment verification fields'
            });
        }

        // Get reservation to verify amount
        const reservation = await Reservation.findById(reservationId);
        if (!reservation) {
            return res.status(404).json({
                success: false,
                error: 'Reservation not found'
            });
        }

        // Verify signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        const isAuthentic = expectedSignature === razorpay_signature;

        if (isAuthentic) {
            // Additional verification: Check if payment amount matches reservation amount
            const order = await razorpay.orders.fetch(razorpay_order_id);
            const expectedAmount = Math.round(reservation.totalPrice * 100);
            
            if (order.amount !== expectedAmount) {
                console.error('Payment amount mismatch:', {
                    expected: expectedAmount,
                    received: order.amount
                });
                await Reservation.findByIdAndUpdate(reservationId, {
                    status: 'failed',
                    paymentError: 'Payment amount mismatch'
                });
                return res.status(400).json({
                    success: false,
                    error: 'Payment verification failed: Amount mismatch'
                });
            }

            // Update reservation status
            await Reservation.findByIdAndUpdate(reservationId, {
                status: 'confirmed',
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
                paymentVerifiedAt: new Date()
            });

            res.json({
                success: true,
                message: 'Payment verified successfully'
            });
        } else {
            await Reservation.findByIdAndUpdate(reservationId, {
                status: 'failed',
                paymentError: 'Invalid signature'
            });

            res.status(400).json({
                success: false,
                error: 'Payment verification failed: Invalid signature'
            });
        }
    } catch (error) {
        console.error('Error verifying payment:', {
            error: error,
            message: error.message,
            stack: error.stack
        });
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
        // Get user directly from database using _id
        const user = await User.findById(req.user._id);
        if (!user) {
            console.error('User not found:', req.user._id);
            req.flash("error", "User not found");
            return res.redirect("/listings");
        }

        console.log('Fetching reservations for user:', { 
            userId: user._id,
            email: user.email,
            name: user.name
        });

        const reservations = await Reservation.find({ user: user._id })
            .populate("listing")
            .sort("-createdAt");

        console.log('Found reservations:', { 
            count: reservations.length,
            userId: user._id
        });

        res.render("reservations/index.ejs", { reservations });
    } catch (error) {
        console.error("Get reservations error:", {
            error: error,
            message: error.message,
            stack: error.stack,
            userId: req.user?._id
        });
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
        // Get or create user from Google OAuth data
        let dbUser;
        try {
            dbUser = await getOrCreateUser(req.user);
        } catch (userError) {
            console.error('Error finding/creating user:', userError);
            if (req.xhr || req.headers.accept.includes('application/json')) {
                return res.status(500).json({
                    success: false,
                    error: "Failed to fetch user data"
                });
            }
            req.flash("error", "Failed to fetch user data");
            return res.redirect("/reservations/my-reservations");
        }

        const reservation = await Reservation.findById(req.params.id);
        
        if (!reservation) {
            if (req.xhr || req.headers.accept.includes('application/json')) {
                return res.status(404).json({
                    success: false,
                    error: "Reservation not found"
                });
            }
            req.flash("error", "Reservation not found");
            return res.redirect("/reservations/my-reservations");
        }

        console.log('Checking reservation ownership:', {
            reservationUserId: reservation.user.toString(),
            currentUserId: dbUser._id.toString(),
            isOwner: reservation.user.equals(dbUser._id)
        });

        // Check if user owns the reservation
        if (!reservation.user.equals(dbUser._id)) {
            if (req.xhr || req.headers.accept.includes('application/json')) {
                return res.status(403).json({
                    success: false,
                    error: "You don't have permission to cancel this reservation"
                });
            }
            req.flash("error", "You don't have permission to cancel this reservation");
            return res.redirect("/reservations/my-reservations");
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
        reservation.cancelledAt = now;
        reservation.cancellationFee = cancellationFee;
        reservation.refundAmount = refundAmount;
        reservation.cancellationReason = cancellationReason;
        reservation.refundStatus = refundAmount > 0 ? 'pending' : 'not_applicable';

        await reservation.save();

        console.log('Reservation cancelled successfully:', {
            reservationId: reservation._id,
            userId: dbUser._id,
            hoursSinceBooking,
            refundAmount,
            cancellationFee
        });

        // Return JSON for AJAX requests
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.json({
                success: true,
                message: "Reservation cancelled successfully",
                cancellationReason,
                refundAmount,
                cancellationFee,
                refundStatus: reservation.refundStatus
            });
        }

        // Regular request - redirect with flash message
        req.flash("success", "Reservation cancelled successfully");
        res.redirect("/reservations/my-reservations");
    } catch (error) {
        console.error("Error cancelling reservation:", {
            error: error,
            message: error.message,
            stack: error.stack,
            user: req.user ? { 
                id: req.user.id,
                email: req.user.emails?.[0]?.value
            } : 'not logged in'
        });

        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(500).json({
                success: false,
                error: "Failed to cancel reservation"
            });
        }

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