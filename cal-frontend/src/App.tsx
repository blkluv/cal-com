// src/App.tsx
import React, { useState } from "react";

interface UserInput {
  username: string;
  startTime: string;
  endTime: string;
}

const App: React.FC = () => {
  const [userInput, setUserInput] = useState<UserInput>({
    username: "",
    startTime: "",
    endTime: "",
  });

  const [slots, setSlots] = useState<any[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [bookingForm, setBookingForm] = useState<any>({});
  const [bookingDetails, setBookingDetails] = useState<any>({});

  const fetchSlots = async () => {
    setLoading(true);
    // dummy example logic
    setTimeout(() => {
      setSlots([{ day: "Monday", times: ["10AM", "11AM"] }]);
      setLoading(false);
    }, 1000);
  };

  const handleBooking = () => {
    // dummy booking logic
    console.log("Booking:", { selectedSlot, selectedDuration, userInput });
  };

  return (
    <div className="container">
      <h1 className="brand-title">
        📺 ATL5D TV <span className="cal-badge">.cal</span>
      </h1>

      <div className="user-input-form card">
        <h2>🚀 Let’s Schedule Your Stream</h2>
        <p>Start by picking your name & dates below.</p>

        <input
          type="text"
          placeholder="📛 Your @username"
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

        <button className="btn-primary" onClick={fetchSlots} disabled={loading}>
          {loading ? "📡 Finding Slots..." : "✨ See When You Can Stream"}
        </button>
      </div>

      {slots.length > 0 && (
        <div>
          <h3>Available Slots:</h3>
          {slots.map((slot, index) => (
            <div key={index}>{JSON.stringify(slot)}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
