import React, { useState } from "react";
import axios from "axios";
import "./App.css"; // Assuming your CSS is in App.css

// --- Interfaces for Data Structure ---
interface AvailabilityDay {
  date: string;
  slots: string[]; // Renamed from 'availability' to 'slots' for clarity
}

interface SlotData {
  duration: number; // Duration in minutes (e.g., 15, 30, 60)
  eventSlug: string; // Cal.com event slug (e.g., '15min-service')
  availability: AvailabilityDay[];
}

interface UserInputSearch {
  username: string; // Cal.com organizer username
  startDate: string;
  endDate: string;
  tiktokUsername: string; // New: User's TikTok username
  irlTravelUsername: string; // New: User's IRL.TRAVEL username
}

interface BookingDetailsResponse {
  bookingId: string; // A unique ID from your backend for this booking
  meetingUrl: string; // Link to the livestream meeting
  startTime: string;
  endTime: string;
  title: string; // Title/description of the booked service
  offeredAmount: string; // The amount the user offered
  // Add other relevant details your backend returns, e.g., vendor info, TikTok channel
}

// --- Message Display Component (for better UX than alert) ---
interface MessageDisplayProps {
  message: string | null;
  type: "success" | "error" | "info" | null;
}

const MessageDisplay: React.FC<MessageDisplayProps> = ({ message, type }) => {
  if (!message) return null;
  const className = `message-display ${type || "info"}`;
  return <div className={className}>{message}</div>;
};

// --- Main App Component ---
function App() {
  // --- State Variables ---
  const [availableSlots, setAvailableSlots] = useState<SlotData[]>([]);
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>(""); // ISO string of selected time slot
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null); // e.g., 15, 30, 60

  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "info" | null>(null);

  // User input for service description and offer
  const [offeredAmount, setOfferedAmount] = useState<string>("");
  const [selectedServiceDescription, setSelectedServiceDescription] = useState<string>("");

  // User input for Cal.com slot search and new usernames
  const [userInputSearch, setUserInputSearch] = useState<UserInputSearch>({
    username: "", // Cal.com organizer username
    startDate: "",
    endDate: "",
    tiktokUsername: "", // Initialize new fields
    irlTravelUsername: "", // Initialize new fields
  });

  // Details for booking submission (attendee details)
  const [attendeeDetails, setAttendeeDetails] = useState({
    name: "",
    email: "",
  });

  const [bookingConfirmationDetails, setBookingConfirmationDetails] = useState<BookingDetailsResponse | null>(null);

  // --- API Base URL ---
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

  // --- Helper for messages ---
  const showMessage = (msg: string, type: "success" | "error" | "info") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage(null);
      setMessageType(null);
    }, 5000); // Message disappears after 5 seconds
  };

  // --- Fetch Available Time Blocks from Cal.com ---
  const fetchAvailableTimeBlocks = async () => {
    if (!selectedServiceDescription || !offeredAmount) {
      showMessage("Please describe your service and enter your offer. 💰", "info");
      return;
    }
    if (!userInputSearch.username || !userInputSearch.startDate || !userInputSearch.endDate) {
      showMessage("Please enter the organizer's @username and date range to find slots. 🗓️", "info");
      return;
    }
    if (!userInputSearch.tiktokUsername || !userInputSearch.irlTravelUsername) {
        showMessage("We need your TikTok & IRL.TRAVEL usernames to make the magic happen! ✨", "info");
        return;
    }

    setLoading(true);
    setMessage(null); // Clear previous messages

    try {
      const response = await axios.post(`${API_BASE_URL}/api/get-available-time-blocks`, {
        username: userInputSearch.username,
        startDate: userInputSearch.startDate,
        endDate: userInputSearch.endDate,
      });
      
      setAvailableSlots(response.data.data); // Assuming response.data.data contains the SlotData array
      if (response.data.data.length === 0 || response.data.data.every((s: SlotData) => s.availability.length === 0)) {
        showMessage("No time slots found for your criteria. Try another date range or organizer. 😔", "info");
      } else {
        showMessage("Available time blocks loaded! ✨", "success");
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Error fetching availability:", error.response?.data || error.message);
        showMessage(error.response?.data?.message || "Failed to fetch available time blocks. 😩", "error");
      } else {
        console.error("Unknown error fetching availability:", error);
        showMessage("An unexpected error occurred while fetching slots. 🐛", "error");
      }
      setAvailableSlots([]); // Clear slots on error
    } finally {
      setLoading(false);
    }
  };

  // --- Handle Booking (Submit Offer) ---
  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotTime || !selectedDuration) {
      showMessage("Please select a specific time slot. ⏰", "info");
      return;
    }
    if (!selectedServiceDescription || !offeredAmount) {
      showMessage("Please describe your service and enter your offer. ✍️", "info");
      return;
    }
    if (!attendeeDetails.name || !attendeeDetails.email) {
      showMessage("Please fill in your name and email for booking. 📧", "info");
      return;
    }

    setLoading(true);
    setMessage(null); // Clear previous messages

    try {
      const response = await axios.post(`${API_BASE_URL}/api/book-service-pwyc`, {
        attendeeName: attendeeDetails.name,
        attendeeEmail: attendeeDetails.email,
        startTime: selectedSlotTime,
        offeredAmount: offeredAmount,
        serviceDescription: selectedServiceDescription,
        bookedDuration: selectedDuration, // The duration of the time slot selected
        calcomOrganizerUsername: userInputSearch.username, // Organizer username for Cal.com
        tiktokUsername: userInputSearch.tiktokUsername, // Pass user's TikTok username
        irlTravelUsername: userInputSearch.irlTravelUsername, // Pass user's IRL.TRAVEL username
        // Add any other metadata needed for backend processing (e.g., TikTok channel, irl.travel ref)
      });

      setBookingConfirmationDetails(response.data.data); // Assuming response.data.data contains BookingDetailsResponse
      showMessage("🎉 Your offer has been submitted & time locked! Check your email for confirmation and next steps. 💌", "success");

      // Reset form states for next booking
      setOfferedAmount("");
      setSelectedServiceDescription("");
      setAvailableSlots([]);
      setSelectedSlotTime("");
      setSelectedDuration(null);
      setUserInputSearch({ username: "", startDate: "", endDate: "", tiktokUsername: "", irlTravelUsername: "" });
      setAttendeeDetails({ name: "", email: "" });

    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Error submitting offer/booking:", error.response?.data || error.message);
        showMessage(error.response?.data?.message || "Failed to submit your offer. Please try again. 😥", "error");
      } else {
        console.error("Unknown error submitting offer/booking:", error);
        showMessage("An unexpected error occurred during booking. 🐛", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Render Logic ---
  return (
    <div className="container">
      <h1 className="brand-title">⏱️ Pay What You Can 💸 ATL5D</h1>
      <MessageDisplay message={message} type={messageType} />

      {/* 1. Define Service & Offer Payment & Usernames */}
      {!selectedDuration && !bookingConfirmationDetails && (
        <div className="pwyc-offer-form card">
          <h2>💬 Describe Your Need & Your Offer! 💰</h2>
          <p>Tell us what Atlanta service you need & what you can contribute. 👇</p>
          <div className="form-group">
              <label htmlFor="serviceDescription">Service Description ✨</label>
              <input
                type="text"
                id="serviceDescription"
                placeholder="e.g., '15-min Livestream Promo', '30-min AR Filter Consult'"
                value={selectedServiceDescription}
                onChange={(e) => setSelectedServiceDescription(e.target.value)}
                required
              />
          </div>
          <div className="form-group">
              <label htmlFor="offeredAmount">Your Offer Amount (USD) 💲</label>
              <input
                type="number"
                id="offeredAmount"
                placeholder="e.g., 50, 150, 404"
                value={offeredAmount}
                onChange={(e) => setOfferedAmount(e.target.value)}
                min="0"
                required
              />
          </div>
          <p className="timeframe-advisory">
            <span role="img" aria-label="clock emoji">⏰</span> Please book at least **24 hours in advance** for us to work our ATL5D magic on the backend! ✨
          </p>
          <h3 className="section-subtitle">Your Socials for the Spotlight:</h3>
          <div className="form-group">
              <label htmlFor="tiktokUsername">Your TikTok @Username 🎵</label>
              <input
                type="text"
                id="tiktokUsername"
                placeholder="e.g., @yourbrandatl"
                value={userInputSearch.tiktokUsername}
                onChange={(e) => setUserInputSearch((prev) => ({ ...prev, tiktokUsername: e.target.value }))}
                required
              />
          </div>
          <div className="form-group">
              <label htmlFor="irlTravelUsername">Your IRL.TRAVEL Username 🌍</label>
              <input
                type="text"
                id="irlTravelUsername"
                placeholder="e.g., yourtravelpage"
                value={userInputSearch.irlTravelUsername}
                onChange={(e) => setUserInputSearch((prev) => ({ ...prev, irlTravelUsername: e.target.value }))}
                required
              />
          </div>
          <div className="form-group">
              <label htmlFor="calcomUsername">ATL5D Organizer @Username (usually 'atl5d') 📛</label>
              <input
                type="text"
                id="calcomUsername"
                placeholder="e.g., 'atl5d'"
                value={userInputSearch.username}
                onChange={(e) => setUserInputSearch((prev) => ({ ...prev, username: e.target.value }))}
              />
          </div>
          <div className="form-group">
              <label htmlFor="startDate">Search Start Date 🗓️</label>
              <input
                type="date"
                id="startDate"
                value={userInputSearch.startDate}
                onChange={(e) => setUserInputSearch((prev) => ({ ...prev, startDate: e.target.value }))}
              />
          </div>
          <div className="form-group">
              <label htmlFor="endDate">Search End Date 🏁</label>
              <input
                type="date"
                id="endDate"
                value={userInputSearch.endDate}
                onChange={(e) => setUserInputSearch((prev) => ({ ...prev, endDate: e.target.value }))}
              />
          </div>
          <button className="btn-primary" onClick={fetchAvailableTimeBlocks} disabled={loading || !selectedServiceDescription || !offeredAmount || !userInputSearch.username || !userInputSearch.tiktokUsername || !userInputSearch.irlTravelUsername}>
            {loading ? "📡 Finding Your Slot..." : "✨ See Available Times"}
          </button>
        </div>
      )}

      {/* 2. Available Durations & Slots Display (after fetch) */}
      {availableSlots.length > 0 && !selectedSlotTime && !bookingConfirmationDetails && (
        <div className="slots-container card">
          <h2>⏱️ Choose a Time Block Length for Your "{selectedServiceDescription}"</h2>
          <p>Pick the duration that fits your vibe. Your offer is ${offeredAmount}.</p>
          <div className="duration-selector pill-row">
            {availableSlots.map((slotData) => (
              <button
                key={slotData.eventSlug}
                onClick={() => setSelectedDuration(slotData.duration)}
                className={`pill-btn ${selectedDuration === slotData.duration ? "active" : ""}`}
              >
                {slotData.duration} mins
              </button>
            ))}
          </div>

          {selectedDuration && (
            <>
              <h2>📅 Pick Your Time Slot ({selectedDuration} mins)</h2>
              {availableSlots
                .find((s) => s.duration === selectedDuration)
                ?.availability.map((day) => (
                  <div key={day.date} className="day-slots card">
                    <h3>{new Date(day.date).toDateString()}</h3>
                    <div className="time-slots">
                      {day.slots.map((time) => (
                        <button
                          key={time}
                          onClick={() => setSelectedSlotTime(time)}
                          className={`time-pill ${selectedSlotTime === time ? "active" : ""}`}
                        >
                          {new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </>
          )}
          {selectedSlotTime && (
            <button className="btn-secondary" onClick={() => setSelectedSlotTime("")}>
              Change Time Slot 🗓️
            </button>
          )}
          <button className="btn-secondary" onClick={() => { setAvailableSlots([]); setSelectedDuration(null); }}>
            Back to Service & Offer 💬
          </button>
        </div>
      )}

      {/* 3. Attendee Details & Submit Offer */}
      {selectedDuration && selectedSlotTime && !bookingConfirmationDetails && (
        <div className="booking-form card">
          <h2>🎙️ Almost There! Confirm Your Deets & Submit Offer!</h2>
          <p>Service: <strong>{selectedServiceDescription}</strong> ({selectedDuration} mins)</p>
          <p>Your Offer: <strong>${offeredAmount}</strong></p>
          <p>Time: <strong>{new Date(selectedSlotTime).toLocaleString()}</strong></p>
          
          <div className="form-group">
            <label htmlFor="attendeeName">Your Display Name 🪪</label>
            <input
              type="text"
              id="attendeeName"
              placeholder="e.g., ATL Vibe Creator"
              value={attendeeDetails.name}
              onChange={(e) => setAttendeeDetails((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="attendeeEmail">Your Email 📧 (for updates)</label>
            <input
              type="email"
              id="attendeeEmail"
              placeholder="e.g., yourname@example.com"
              value={attendeeDetails.email}
              onChange={(e) => setAttendeeDetails((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>
          <button className="btn-primary" type="submit" onClick={handleSubmitOffer} disabled={loading}>
            {loading ? "📡 Submitting Offer..." : `🚨 Submit Offer & Book Time!`}
          </button>
          <button className="btn-secondary" onClick={() => setSelectedSlotTime("")}>
            Change Time Slot 🗓️
          </button>
        </div>
      )}

      {/* 4. Booking Confirmation */}
      {bookingConfirmationDetails && (
        <div className="booking-confirmation card">
          <h2>🎉 Offer Submitted & Time Locked! 🔥</h2>
          <p className="confirmation-message">
            Your offer of **${bookingConfirmationDetails.offeredAmount}** for "{bookingConfirmationDetails.title}" is submitted, and your time is locked in! 🚀
            Details are winging their way to your email. 💌
          </p>
          <p className="confirmation-action">
            👇 **What's Next: Your Bid in the ATL5D 🅰️conomy!** 👇
          </p>
          <p>
            Your reel request based on your offer will be posted on the appropriate TikTok channel.
            <br/>
            Follow <a href="https://tiktok.com/@ATL5D" target="_blank" rel="noopener noreferrer" className="tiktok-link">@ATL5D on TikTok</a> to see and engage with the bids! 💖
            <br/>
            Join <a href="https://irl.travel" target="_blank" rel="noopener noreferrer" className="irl-link">IRL.TRAVEL</a> to see the before/after proof of service. You'll approve the service there to release funds to the vendor! ✅
          </p>
          <div className="booking-details">
            <p>🆔 <strong>Booking ID:</strong> {bookingConfirmationDetails.bookingId}</p>
            <p>🧠 <strong>Service:</strong> {bookingConfirmationDetails.title}</p>
            <p>🕒 <strong>Time:</strong> {new Date(bookingConfirmationDetails.startTime).toLocaleString()} - {new Date(bookingConfirmationDetails.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
            {bookingConfirmationDetails.meetingUrl && (
              <p>
                🔗 <strong>Livestream Link:</strong>{" "}
                <a href={bookingConfirmationDetails.meetingUrl} target="_blank" rel="noopener noreferrer">
                  Join Your ATL5D.TV Room
                </a>
              </p>
            )}
          </div>
          <button className="btn-primary" onClick={() => {
            setBookingConfirmationDetails(null);
            setSelectedDuration(null); // Go back to start
            setSelectedServiceDescription(""); // Reset service description
            setOfferedAmount(""); // Reset offer
          }}>
            🔄 Book Another Service 🚀
          </button>
        </div>
      )}
    </div>
  );
}

export default App;