<div className="container">
  <h1 className="brand-title">📺 ATL5D TV <span className="cal-badge">.cal</span></h1>

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
    <div className="duration-selector">
      <h2>⏱️ Pick Your Stream Length</h2>
      <div className="pill-row">
        {slots.map((slot) => (
          <button
            key={slot.eventSlug}
            onClick={() => setSelectedDuration(slot.eventSlug)}
            className={`pill-btn ${
              selectedDuration === slot.eventSlug ? "active" : ""
            }`}
          >
            {slot.duration} mins
          </button>
        ))}
      </div>
    </div>
  )}

  {selectedDuration && (
    <div className="slots-container">
      <h2>📅 Available Stream Times</h2>
      {slots
        .find((slot) => slot.eventSlug === selectedDuration)
        ?.availability.map((day) => (
          <div key={day.date} className="day-slots card">
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
                  className={`time-pill ${
                    selectedSlot === time ? "active" : ""
                  }`}
                >
                  {new Date(time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </button>
              ))}
            </div>
          </div>
        ))}
    </div>
  )}

  {selectedSlot && (
    <div className="booking-form card">
      <h2>🎙️ Stream Details</h2>
      <form onSubmit={handleBooking}>
        <input
          type="text"
          placeholder="🪪 Display Name"
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
          placeholder="📧 Email (for link)"
          value={bookingForm.attendeeEmail}
          onChange={(e) =>
            setBookingForm((prev) => ({
              ...prev,
              attendeeEmail: e.target.value,
            }))
          }
          required
        />
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? "📡 Booking..." : "🚨 Lock In My Stream"}
        </button>
      </form>
    </div>
  )}

  {bookingDetails && (
    <div className="booking-confirmation card">
      <h2>🔥 You're On the Air!</h2>
      <p>Here’s your livestream deets:</p>
      <div className="booking-details">
        <p>🆔 <strong>ID:</strong> {bookingDetails.id}</p>
        <p>🧠 <strong>Title:</strong> {bookingDetails.title}</p>
        <p>🕒 <strong>Start:</strong> {new Date(bookingDetails.start).toLocaleString()}</p>
        <p>🏁 <strong>End:</strong> {new Date(bookingDetails.end).toLocaleString()}</p>
        <p>
          🔗 <strong>Link:</strong>{" "}
          <a href={bookingDetails.meetingUrl} target="_blank" rel="noopener noreferrer">
            Join Your ATL5D.TV Room
          </a>
        </p>
      </div>
      <button className="btn-secondary" onClick={() => setBookingDetails(null)}>
        🔄 Schedule Another
      </button>
    </div>
  )}
</div>
