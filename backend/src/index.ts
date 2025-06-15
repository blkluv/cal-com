import dotenv from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import axios from "axios";
import { paymentMiddleware, Resource } from "x402-express";
dotenv.config();

// Constants
const PORT = process.env.PORT || 3000;
const FACILITATOR_URL = "https://x402.org/facilitator" as Resource;
const CAL_COM_API_KEY = process.env.CAL_COM_API_KEY as string;
const PUBLIC_ADDRESS = process.env.PUBLIC_ADDRESS as `0x${string}`;

// App setup
const app = express();
app.use(cors());
app.use(express.json());

// X402 Payment Middleware (hold funds until TikTok proof)
app.use(
  paymentMiddleware(
    PUBLIC_ADDRESS,
    {
      "POST /book": {
        price: "$5.00", // Base fee (adjust per industry)
        network: "base-sepolia",
      },
    },
    { url: FACILITATOR_URL }
  )
);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

// Get available slots (15/30/60 mins)
app.post("/slots", async (req: Request, res: Response) => {
  const { username, duration, startTime, endTime } = req.body;

  if (!username) return res.status(400).json({ error: "TikTok username required" });

  try {
    // Fetch event types from Cal.com (pre-configured for 15/30/60 mins)
    const response = await axios.get(
      `https://api.cal.com/v2/event-types?username=${username}`,
      {
        headers: {
          Authorization: CAL_COM_API_KEY,
          "cal-api-version": "2024-06-14",
        },
      }
    );

    // Filter by duration (e.g., 15, 30, 60 mins)
    const slots = response.data.data
      .filter((event: any) => [15, 30, 60].includes(event.lengthInMinutes))
      .map((event: any) => ({
        duration: event.lengthInMinutes,
        slug: event.slug,
        price: `$${(event.lengthInMinutes / 15) * 5}.00`, // $5 per 15 mins
      }));

    res.json({ slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch slots" });
  }
});

// Book a session (payment held until TikTok proof)
app.post("/book", async (req: Request, res: Response) => {
  const { 
    username,       // Vendor's TikTok handle (e.g., "atlbarber")
    eventTypeSlug,  // "15-min", "30-min", etc.
    startTime,      // ISO timestamp
    clientTikTok,   // Client's TikTok handle (for tagging)
    postId          // Original TikTok post ID (e.g., "30080 Barber wanted ASAP")
  } = req.body;

  if (!username || !eventTypeSlug || !startTime || !postId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Step 1: Book via Cal.com
    const booking = await axios.post(
      "https://api.cal.com/v2/bookings",
      {
        start: startTime,
        eventTypeSlug,
        username,
        metadata: { postId, clientTikTok }, // Store for verification
      },
      {
        headers: {
          Authorization: CAL_COM_API_KEY,
          "cal-api-version": "2024-08-13",
        },
      }
    );

    // Step 2: Return booking ID + payment instructions
    res.json({
      success: true,
      bookingId: booking.data.id,
      paymentPending: true,
      instructions: `Post a before/after TikTok tagging @${clientTikTok} and #${postId} to release payment.`,
    });
  } catch (error: any) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Booking failed" });
  }
});

// Webhook for TikTok verification (called manually or via automation)
app.post("/verify-tiktok", async (req: Request, res: Response) => {
  const { bookingId, tiktokUrl } = req.body;

  // Validate TikTok post (pseudo-code)
  const isValid = await checkTikTokPost(tiktokUrl); // Implement scraping/API checks

  if (isValid) {
    // Release X402 payment
    await releasePayment(bookingId);
    res.json({ success: true, paymentReleased: true });
  } else {
    res.status(400).json({ error: "Invalid proof. Tag the original post." });
  }
});

// Helper function (mock)
async function checkTikTokPost(url: string): Promise<boolean> {
  // Use TikTok API/web scraper to verify:
  // 1. Post tags the client's handle (@clientTikTok)
  // 2. Post includes the original hashtag (#postId)
  return true; // Placeholder
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
