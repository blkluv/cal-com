import { useState } from "react";
import axios from "axios";
import "./App.css";

interface Availability {
  date: string;
  availability: string[];
}

interface SlotData {
  duration: string;
  eventSlug: string;
  availability: Availability[];
}

interface UserInputData {
  username: string;
  startTime: string;
  endTime: string;
}

interface BookingResponse {
  id: number;
  meetingUrl: string;
  start: string;
  end: string;
  title: string;
}

function App() {
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [selectedDuration, setSelectedDuration] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [userInput, setUserInput] = useState<UserInputData>({
    username: "",
    startTime: "",
    endTime: "",
  });

  const [bookingForm, setBookingForm] = useState({
    attendeeName: "",
    attendeeEmail: "",
    startTime: "",
    username: "",
    eventTypeSlug: "",
  });

  const [bookingDetails, setBookingDetails] = useState<BookingResponse | null>(
    null
  );

  const fetchSlots = async () => {
    if (!userInput.username || !userInput.startTime || !userInput.endTime) {
      alert("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      const { data } = await axios.post("http://localhost:3000/get-slots", {
        username: userInput.username,
        duration: 30,
        startTime: userInput.startTime,
        endTime: userInput.endTime,
      });
      setSlots(data.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          "Error fetching slots:",
          error.response?.data || error.message
        );
        alert(
          error.response?.data?.message || "Error fetching available slots"
        );
      } else {
        console.error("Error fetching slots:", error);
        alert("Error fetching available slots");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingForm.attendeeName || !bookingForm.attendeeEmail) {
      alert("Please fill in all booking details");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post("http://localhost:3000/book-meeting", {
        ...bookingForm,
        username: userInput.username,
      });

      // Store booking details
      setBookingDetails(data.data.data);
      alert("Meeting booked successfully!");
      setSelectedSlot("");
      setBookingForm({
        attendeeName: "",
        attendeeEmail: "",
        startTime: "",
        username: "",
        eventTypeSlug: "",
      });
      // Refresh available slots
      fetchSlots();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          "Error booking meeting:",
          error.response?.data || error.message
        );
        alert(error.response?.data?.message || "Error booking meeting");
      } else {
        console.error("Error booking meeting:", error);
        alert("Error booking meeting");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Meeting Scheduler</h1>

      <div className="user-input-form">
        <h2>Enter Details to View Available Slots</h2>
        <input
          type="text"
          placeholder="Username"
          value={userInput.username}
          onChange={(e) =>
            setUserInput((prev) => ({ ...prev, username: e.target.value }))
          }
        />
        <input
          type="date"
          value={userInput.startTime}
          onChange={(e) =>
            setUserInput((prev) => ({ ...prev, startTime: e.target.value }))
          }
        />
        <input
          type="date"
          value={userInput.endTime}
          onChange={(e) =>
            setUserInput((prev) => ({ ...prev, endTime: e.target.value }))
          }
        />
        <button onClick={fetchSlots} disabled={loading}>
          {loading ? "Loading..." : "View Available Slots"}
        </button>
      </div>

      {slots.length > 0 && (
        <div className="duration-selector">
          <h2>Select Duration</h2>
          {slots.map((slot) => (
            <button
              key={slot.eventSlug}
              onClick={() => setSelectedDuration(slot.eventSlug)}
              className={selectedDuration === slot.eventSlug ? "active" : ""}
            >
              {slot.duration}
            </button>
          ))}
        </div>
      )}

      {selectedDuration && (
        <div className="slots-container">
          <h2>Available Slots</h2>
          {slots
            .find((slot) => slot.eventSlug === selectedDuration)
            ?.availability.map((day) => (
              <div key={day.date} className="day-slots">
                <h3>{new Date(day.date).toDateString()}</h3>
                <div className="time-slots">
                  {day.availability.map((time) => (
                    <button
                      key={time}
                      onClick={() => {
                        setSelectedSlot(time);
                        setBookingForm((prev) => ({
                          ...prev,
                          startTime: time,
                          eventTypeSlug: selectedDuration,
                        }));
                      }}
                      className={selectedSlot === time ? "active" : ""}
                    >
                      {new Date(time).toLocaleTimeString()}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {selectedSlot && (
        <div className="booking-form">
          <h2>Book Meeting</h2>
          <form onSubmit={handleBooking}>
            <input
              type="text"
              placeholder="Your Name"
              value={bookingForm.attendeeName}
              onChange={(e) =>
                setBookingForm((prev) => ({
                  ...prev,
                  attendeeName: e.target.value,
                }))
              }
              required
            />
            <input
              type="email"
              placeholder="Your Email"
              value={bookingForm.attendeeEmail}
              onChange={(e) =>
                setBookingForm((prev) => ({
                  ...prev,
                  attendeeEmail: e.target.value,
                }))
              }
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? "Booking..." : "Book Meeting"}
            </button>
          </form>
        </div>
      )}

      {bookingDetails && (
        <div className="booking-confirmation">
          <h2>Booking Confirmed! 🎉</h2>
          <div className="booking-details">
            <p>
              <strong>Booking ID:</strong> {bookingDetails.id}
            </p>
            <p>
              <strong>Meeting Title:</strong> {bookingDetails.title}
            </p>
            <p>
              <strong>Start Time:</strong>{" "}
              {new Date(bookingDetails.start).toLocaleString()}
            </p>
            <p>
              <strong>End Time:</strong>{" "}
              {new Date(bookingDetails.end).toLocaleString()}
            </p>
            <p>
              <strong>Meeting URL:</strong>{" "}
              <a
                href={bookingDetails.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {bookingDetails.meetingUrl}
              </a>
            </p>
          </div>
          <button
            onClick={() => setBookingDetails(null)}
            className="dismiss-button"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
