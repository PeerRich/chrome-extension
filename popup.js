// Popup script

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// Group no-shows by event
function groupNoShowsByEvent(noShows) {
  const events = {}

  // First pass: collect all events
  for (const eventId in noShows) {
    events[eventId] = {
      id: eventId,
      title: `Event ${eventId.substring(0, 8)}...`, // Placeholder title
      attendees: [],
    }

    // Collect attendees
    for (const email in noShows[eventId]) {
      events[eventId].attendees.push({
        email: email,
        name: noShows[eventId][email].name || email,
        timestamp: noShows[eventId][email].timestamp,
      })
    }
  }

  return Object.values(events)
}

// Render no-shows in the popup
function renderNoShows(noShows) {
  const container = document.getElementById("no-shows-container")

  // Clear container
  container.innerHTML = ""

  // Group by event
  const events = groupNoShowsByEvent(noShows)

  if (events.length === 0) {
    container.innerHTML = '<div class="empty-state">No attendees have been marked as no-shows yet.</div>'
    return
  }

  // Render each event group
  events.forEach((event) => {
    const eventElement = document.createElement("div")
    eventElement.className = "event-group"

    // Event title
    const titleElement = document.createElement("div")
    titleElement.className = "event-title"
    titleElement.textContent = event.title
    eventElement.appendChild(titleElement)

    // Attendees
    event.attendees.forEach((attendee) => {
      const attendeeElement = document.createElement("div")
      attendeeElement.className = "attendee-item"

      const nameElement = document.createElement("div")
      nameElement.className = "attendee-name"
      nameElement.textContent = attendee.name
      attendeeElement.appendChild(nameElement)

      const dateElement = document.createElement("div")
      dateElement.className = "attendee-date"
      dateElement.textContent = formatDate(attendee.timestamp)
      attendeeElement.appendChild(dateElement)

      eventElement.appendChild(attendeeElement)
    })

    container.appendChild(eventElement)
  })
}

// Export no-shows data as CSV
function exportNoShowsAsCSV(noShows) {
  let csvContent = "Event ID,Attendee Name,Attendee Email,Timestamp\n"

  for (const eventId in noShows) {
    for (const email in noShows[eventId]) {
      const attendee = noShows[eventId][email]
      const row = [eventId, attendee.name || "", email, attendee.timestamp]
        .map((value) => `"${value.replace(/"/g, '""')}"`)
        .join(",")

      csvContent += row + "\n"
    }
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", `calendar-no-shows-${new Date().toISOString().split("T")[0]}.csv`)
  link.style.display = "none"

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Clear all no-shows data
function clearAllNoShows() {
  if (confirm("Are you sure you want to clear all no-show data? This cannot be undone.")) {
    chrome.runtime.sendMessage({ action: "clearAllNoShows" }, (response) => {
      if (response && response.success) {
        loadNoShows()
      }
    })
  }
}

// Toggle debug mode
function toggleDebugMode() {
  chrome.runtime.sendMessage({ action: "toggleDebug" }, (response) => {
    if (response) {
      const debugStatus = document.getElementById("debug-status")
      if (debugStatus) {
        debugStatus.textContent = response.debug ? "ON" : "OFF"
      }

      alert(`Debug mode ${response.debug ? "enabled" : "disabled"}. Check the browser console for logs.`)
    }
  })
}

// Force refresh of no-show buttons
function refreshButtons() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes("calendar.google.com")) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "forceRefresh" }, (response) => {
        if (response && response.success) {
          alert("No-Show buttons refreshed. If you don't see them, try scrolling or changing views.")
        } else {
          alert("Could not refresh buttons. Make sure you're on a Google Calendar page.")
        }
      })
    } else {
      alert("Please navigate to Google Calendar to use this feature.")
    }
  })
}

// Check Cal.com login status
function checkCalComLogin() {
  chrome.runtime.sendMessage({ action: "checkCalComLogin" }, (response) => {
    const mainContent = document.getElementById("main-content")
    const loginSection = document.getElementById("login-section")

    if (response && !response.isLoggedIn) {
      // If not logged in, hide main content and show login section
      mainContent.style.display = "none"
      loginSection.style.display = "flex"
    } else {
      // If logged in, show main content and hide login section
      mainContent.style.display = "block"
      loginSection.style.display = "none"
    }
  })
}

// Handle Cal.com login
function handleCalComLogin() {
  chrome.tabs.create({ url: "https://cal.com/login" })
}

// Load no-shows from storage
function loadNoShows() {
  chrome.storage.sync.get("calendarNoShows", (data) => {
    const noShows = data.calendarNoShows || {}
    renderNoShows(noShows)
  })
}

// Initialize popup
document.addEventListener("DOMContentLoaded", () => {
  // Check Cal.com login status first
  checkCalComLogin()

  // Load and render no-shows
  loadNoShows()

  // Set up button handlers
  document.getElementById("export-data").addEventListener("click", () => {
    chrome.storage.sync.get("calendarNoShows", (data) => {
      exportNoShowsAsCSV(data.calendarNoShows || {})
    })
  })

  document.getElementById("clear-all").addEventListener("click", clearAllNoShows)
  document.getElementById("toggle-debug").addEventListener("click", toggleDebugMode)
  document.getElementById("refresh-buttons").addEventListener("click", refreshButtons)

  // Set up Cal.com login button
  const loginButton = document.getElementById("login-button")
  if (loginButton) {
    loginButton.addEventListener("click", handleCalComLogin)
  }

  // Check current debug status
  chrome.runtime.sendMessage({ action: "getDebugStatus" }, (response) => {
    if (response) {
      const debugStatus = document.getElementById("debug-status")
      if (debugStatus) {
        debugStatus.textContent = response.debug ? "ON" : "OFF"
      }
    }
  })
})
