import dotenv from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import axios, { AxiosError } from "axios"; // Import AxiosError for better typing
import { paymentMiddleware, Resource } from "x402-express"; // For protecting your own endpoints
import { privateKeyToAccount } from "viem/accounts"; // For making x402-axios calls from server if needed
import { withPaymentInterceptor, decodeXPaymentResponse } from "x402-axios"; // For making x402-axios calls from server if needed
import { Hex } from "viem"; // For private key typing

dotenv.config();

// --- Environment Variables ---
const CAL_COM_API_KEY = process.env.CAL_COM_API_KEY as string;
const X402_EXPRESS_PRIVATE_KEY = process.env.X402_EXPRESS_PRIVATE_KEY as Hex; // Your server's private key for paymentMiddleware
const X402_CLIENT_PRIVATE_KEY = process.env.X402_CLIENT_PRIVATE_KEY as Hex; // If this backend needs to act as a client making x402 calls
const X402_FACILITATOR_URL = process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator" as Resource;

const app = express();
const PORT = process.env.PORT || 3000; // Use environment PORT for Vercel

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Enable JSON body parsing

// --- x402-express Middleware to PROTECT your /api/book-service-pwyc endpoint ---
// This middleware requires incoming requests (from your React frontend) to pay or prove payment.
if (X402_EXPRESS_PRIVATE_KEY) {
  app.use(
    paymentMiddleware(
      X402_EXPRESS_PRIVATE_KEY, // The private key this server uses to sign challenges
      {
        "POST /api/book-service-pwyc": {
          price: "$0.001", // This is the base price your API charges for the request itself
          network: "base-sepolia", // Adjust to your actual network
        },
        // Add other protected endpoints here if necessary
      },
      { url: X402_FACILITATOR_URL }
    )
  );
} else {
  console.warn("X402_EXPRESS_PRIVATE_KEY not set. /api/book-service-pwyc will NOT be protected by x402-express middleware.");
}


// --- 1. Endpoint to get available time blocks (replaces /get-slots) ---
// This endpoint now fetches ALL event types for a username and returns their slots.
app.post("/api/get-available-time-blocks", async (req: Request, res: Response) => {
  let { startDate, endDate, username } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Organizer username is required." });
  }

  // Set default dates if not provided
  if (!startDate) {
    startDate = new Date().toISOString();
  }
  if (!endDate) {
    // Default to 14 days from now if no end date
    const defaultEndDate = new Date();
    defaultEndDate.setDate(defaultEndDate.getDate() + 14);
    endDate = defaultEndDate.toISOString();
  }

  try {
    // 1. Get all event types for the given username
    const eventTypesResponse = await axios.get(
      `https://api.cal.com/v2/event-types?username=${username}`,
      {
        headers: {
          Authorization: `Bearer ${CAL_COM_API_KEY}`,
          "cal-api-version": "2024-09-04", // Use a consistent API version
        },
      }
    );
    const eventTypes = eventTypesResponse.data.data;

    const possibleSlots: any[] = [];

    // 2. For each event type, fetch its available slots
    for (const eventType of eventTypes) {
      // Cal.com returns event types with duration and slug
      const { lengthInMinutes, slug } = eventType;

      // Skip event types that are not suitable for time-block booking (e.g., too short/long or fixed dates)
      // You might want a filter here based on your Cal.com event type naming conventions
      if (!lengthInMinutes || !slug || ![15, 30, 60].includes(lengthInMinutes)) {
         console.warn(`Skipping event type: ${slug} with duration ${lengthInMinutes} minutes. Not a standard time block.`);
         continue;
      }

      try {
        const slotsResponse = await axios.get(
          `https://api.cal.com/v2/slots?start=${startDate}&end=${endDate}&username=${username}&eventTypeSlug=${slug}`,
          {
            headers: {
              Authorization: `Bearer ${CAL_COM_API_KEY}`, // API key needed for slots endpoint sometimes
              "cal-api-version": "2024-09-04",
            },
          }
        );

        const formattedSlots = Object.entries(slotsResponse.data.data).map(
          ([date, timeSlots]) => ({
            date,
            slots: (timeSlots as any[]).map((slot: any) => slot.start), // Extract only the start time
          })
        );

        // Only add if there are actual slots available for this event type
        if (formattedSlots.some(day => day.slots.length > 0)) {
            possibleSlots.push({
                duration: lengthInMinutes, // The numeric duration
                eventSlug: slug,
                availability: formattedSlots,
            });
        }

      } catch (slotError: any) {
        console.error(`Error fetching slots for event type ${slug}:`, slotError.response?.data || slotError.message);
        // Continue to next event type if one fails
      }
    }

    // Filter out event types that have no availability
    const filteredPossibleSlots = possibleSlots.filter(slot =>
        slot.availability.some((day: any) => day.slots && day.slots.length > 0)
    );

    res.json({
      message: "Available time blocks retrieved successfully",
      data: filteredPossibleSlots,
    });

  } catch (err: any) {
    console.error("Error in /api/get-available-time-blocks:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch event types or slots from Cal.com." });
  }
});


// --- 2. Endpoint to book a service with PWYC and x402 payment ---
// This replaces /book-meeting and /book-meeting-x402
app.post("/api/book-service-pwyc", async (req: Request, res: Response) => {
  const {
    attendeeName,
    attendeeEmail,
    startTime,          // Selected slot start time
    offeredAmount,      // User's pay-what-you-can offer
    serviceDescription, // User's description of service needed
    bookedDuration,     // The duration of the selected slot (e.g., 15, 30, 60)
    calcomOrganizerUsername, // Organizer username from frontend
    tiktokUsername,     // User's TikTok username
    irlTravelUsername,  // User's IRL.TRAVEL username
  } = req.body;

  // --- Input Validation ---
  if (
    !attendeeName ||
    !attendeeEmail ||
    !startTime ||
    !offeredAmount ||
    !serviceDescription ||
    !bookedDuration ||
    !calcomOrganizerUsername ||
    !tiktokUsername ||
    !irlTravelUsername
  ) {
    return res.status(400).json({
      error: "Missing required fields for booking. Please provide all details.",
    });
  }

  // --- Convert offeredAmount to a number ---
  const numericOfferedAmount = parseFloat(offeredAmount);
  if (isNaN(numericOfferedAmount) || numericOfferedAmount < 0) {
    return res.status(400).json({ error: "Invalid offered amount." });
  }

  try {
    // --- Phase 1: Call Cal.com API to create the booking ---
    // (This part doesn't handle payment, it just reserves the slot)
    const calcomBookingResponse = await axios.post(
      "https://api.cal.com/v2/bookings",
      {
        attendee: {
          language: "en",
          name: attendeeName,
          timeZone: "America/New_York", // Or retrieve from client
          email: attendeeEmail,
        },
        start: startTime,
        // You need to map bookedDuration back to an actual eventTypeSlug in Cal.com
        // This assumes your Cal.com event slugs are structured like '15min-service', '30min-service', etc.
        eventTypeSlug: `${bookedDuration}min-service`, // Adjust this to your actual Cal.com event slug naming convention
        username: calcomOrganizerUsername,
        // Include custom booking fields if Cal.com allows them via API
        customInputs: {
            serviceDescription: serviceDescription,
            offeredAmount: offeredAmount,
            tiktokUsername: tiktokUsername,
            irlTravelUsername: irlTravelUsername,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${CAL_COM_API_KEY}`,
          "Content-Type": "application/json",
          "cal-api-version": "2024-09-04", // Use a consistent API version
        },
      }
    );

    const calcomBookingDetails = calcomBookingResponse.data.data;
    console.log("Cal.com Booking created:", calcomBookingDetails);

    // --- Phase 2: Process Payment via x402-axios (Server-Side Client) ---
    // This part simulates a server-side client initiating the x402 payment
    // based on the user's offer. This is where your custom payment logic lives.
    if (!X402_CLIENT_PRIVATE_KEY) {
        console.warn("X402_CLIENT_PRIVATE_KEY not set. Skipping server-side x402 payment call.");
        // If no private key, consider this a free booking or handle error
        return res.status(200).json({
            message: "Booking created, but payment bypassed (x402 client key missing).",
            data: {
                bookingId: calcomBookingDetails.id,
                meetingUrl: calcomBookingDetails.rescheduleLink, // Cal.com's reschedule link often doubles as meeting link until confirmed
                startTime: calcomBookingDetails.start,
                endTime: calcomBookingDetails.end,
                title: serviceDescription,
                offeredAmount: offeredAmount,
                status: "pending_payment_server_side_skipped"
            }
        });
    }

    const account = privateKeyToAccount(X402_CLIENT_PRIVATE_KEY);
    const internalX402Api = withPaymentInterceptor(
        axios.create({
            baseURL: "https://cal-kex3f2hj0-blkluvorgs-projects.vercel.app/", // THIS NEEDS TO BE YOUR SERVER'S OWN URL (e.g., https://your-atl5d-backend.vercel.app) IN PRODUCTION!
            timeout: 15000, // Increased timeout for payment processing
        }),
        account
    );

    // This call is from your backend to itself, protected by x402-express paymentMiddleware
    // The price here should match the price you defined in paymentMiddleware for this endpoint,
    // or you can dynamically set it if your paymentMiddleware is flexible.
    // For PWYC, the client-side x402-axios might *already* be attempting to pay this amount.
    // This server-side call might be redundant if the frontend already fully handles the x402 payment.
    // Re-evaluate if this server-side x402 client call is truly needed based on your x402 setup.
    // If frontend already sends payment proof, then this server-side payment call is NOT needed.
    // Instead, you'd process the x-payment-proof from the incoming request.
    const internalX402Response = await internalX402Api.post(
      "/api/process-pwyc-payment", // A new internal endpoint to handle payment processing for PWYC
      {
        calcomBookingId: calcomBookingDetails.id,
        offeredAmount: numericOfferedAmount,
        attendeeEmail: attendeeEmail,
        // ... any other data needed for internal payment record keeping
      }
    );

    console.log("Internal x402 payment API response:", internalX402Response.data);
    const paymentResponseDetails = decodeXPaymentResponse(internalX402Response.headers["x-payment-response"]);
    console.log("Internal x402 payment details:", paymentResponseDetails);

    // --- Phase 3: Fulfillment (TikTok, IRL.TRAVEL, etc.) ---
    // These are placeholders for your actual fulfillment logic.
    // This logic would happen AFTER payment is confirmed.

    // Example: Trigger TikTok reel request (Backend-to-TikTok API)
    console.log(`Triggering TikTok reel for @${tiktokUsername} for service: ${serviceDescription}`);
    // await axios.post("YOUR_TIKTOK_INTEGRATION_API", { ... });

    // Example: Record on IRL.TRAVEL (Backend-to-IRL.TRAVEL API or your database)
    console.log(`Recording service for @${irlTravelUsername} on IRL.TRAVEL for booking ID: ${calcomBookingDetails.id}`);
    // await axios.post("YOUR_IRL_TRAVEL_INTEGRATION_API", { ... });

    // --- Final Response to Frontend ---
    res.json({
      message: "Offer submitted & booking created successfully! Payment processing initiated.",
      data: {
        bookingId: calcomBookingDetails.id,
        meetingUrl: calcomBookingDetails.rescheduleLink, // Cal.com's reschedule link often doubles as meeting link until confirmed
        startTime: calcomBookingDetails.start,
        endTime: calcomBookingDetails.end,
        title: serviceDescription, // Use the user's description as the title
        offeredAmount: offeredAmount,
        status: "confirmed"
      },
    });

  } catch (error: any) {
    console.error(
      "Error in /api/book-service-pwyc:",
      error.response?.data || error.message
    );
    res.status(500).json({
      error: "Failed to process booking offer.",
      details: error.response?.data || error.message,
    });
  }
});


// --- NEW: Endpoint to handle internal PWYC payment processing (if needed) ---
// This endpoint would be protected by paymentMiddleware,
// and called by your own backend (from /api/book-service-pwyc above)
// OR directly by the frontend if the frontend is making the x402 payment.
// This is currently conceptual and depends heavily on your x402 architecture.
app.post("/api/process-pwyc-payment", async (req: Request, res: Response) => {
    // This endpoint exists purely to be protected by x402-express's paymentMiddleware
    // and would simply confirm payment and then you'd handle your internal logic.
    // The actual payment proof (x-payment-proof header) would be processed by paymentMiddleware.
    const { calcomBookingId, offeredAmount, attendeeEmail } = req.body;
    console.log(`Received internal payment request for Cal.com booking ID: ${calcomBookingId}`);
    console.log(`Offered amount: $${offeredAmount}, Email: ${attendeeEmail}`);

    // In a real scenario, you might:
    // 1. Store this payment record in your database.
    // 2. Validate the offeredAmount against minimums or internal policies.
    // 3. Update the booking status (e.g., from 'pending_payment' to 'paid').

    res.json({
        success: true,
        message: "Payment proof received and processed internally.",
        details: { calcomBookingId, offeredAmount, status: "payment_accepted" }
    });
});


// --- Health Check Endpoint ---
app.get("/health", (req, res) => {
  res.json({ message: "healthy" });
});

app.listen(PORT, () => {
  console.log(`⚡ Server is running on localhost:${PORT}`);
});