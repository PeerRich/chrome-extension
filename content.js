// Main content script that runs on Google Calendar pages

// Configuration
const config = {
  // Target elements with role="treeitem" for attendees
  attendeeSelectors: [
    "div[role='treeitem']", // Primary selector - attendee container
    "[data-hovercard-id]", // Email elements
    ".gPPhwb", // Original selector
    ".Jmftzc.EGSDee", // Another possible selector
  ],
  buttonClass: "no-show-button",
  noShowClass: "no-show-attendee",
  storageKey: "calendarNoShows",
  debug: true, // Enable debug mode for troubleshooting

  // SVG icons
  icons: {
    eyeOff: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-off"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>`,
    eye: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  },
}

// Add a debug logging function
function debugLog(...args) {
  if (config.debug) {
    console.log("[No-Show Extension]", ...args)
  }
}

// Track no-shows in memory
let noShows = {}

// Track current URL to detect changes
let currentUrl = window.location.href

// Get event ID from URL or generate a fallback
function getEventId() {
  // Try to get event ID from URL parameters
  const urlParams = new URLSearchParams(window.location.search)
  const eid = urlParams.get("eid")

  if (eid) return eid

  // Try to extract from URL path
  const pathMatch = window.location.pathname.match(/\/event\/([^/]+)/)
  if (pathMatch && pathMatch[1]) return pathMatch[1]

  // If we're in a calendar view with no specific event ID
  // use the current date as a fallback ID
  const today = new Date()
  return `calendar-view-${today.toISOString().split("T")[0]}`
}

// Check if we're viewing a calendar event
function isCalendarEventView() {
  return (
    window.location.href.includes("/eventedit") ||
    window.location.href.includes("/event") ||
    window.location.search.includes("eid=")
  )
}

// Load saved no-shows from storage
function loadNoShows() {
  if (typeof chrome !== "undefined" && chrome.storage) {
    chrome.storage.sync.get(config.storageKey, (data) => {
      if (data && data[config.storageKey]) {
        noShows = data[config.storageKey]
        applyNoShowStyling()
      }
    })
  } else {
    console.warn("Chrome storage API not available.")
  }
}

// Save no-shows to storage
function saveNoShows() {
  if (typeof chrome !== "undefined" && chrome.storage) {
    chrome.storage.sync.set({ [config.storageKey]: noShows })
  } else {
    console.warn("Chrome storage API not available.")
  }
}

// Mark an attendee as a no-show
function markAsNoShow(eventId, attendeeEmail, attendeeName, attendeeEl) {
  if (!noShows[eventId]) {
    noShows[eventId] = {}
  }

  noShows[eventId][attendeeEmail] = {
    name: attendeeName,
    timestamp: new Date().toISOString(),
    eventId: eventId,
  }

  // Add the no-show class to the attendee element
  if (attendeeEl) {
    attendeeEl.classList.add(config.noShowClass)
  }

  saveNoShows()
}

// Remove no-show status
function removeNoShow(eventId, attendeeEmail, attendeeEl) {
  if (noShows[eventId] && noShows[eventId][attendeeEmail]) {
    delete noShows[eventId][attendeeEmail]

    // Clean up empty event entries
    if (Object.keys(noShows[eventId]).length === 0) {
      delete noShows[eventId]
    }

    // Remove the no-show class from the attendee element
    if (attendeeEl) {
      attendeeEl.classList.remove(config.noShowClass)
    }

    saveNoShows()
  }
}

// Apply styling to no-show attendees
function applyNoShowStyling() {
  const eventId = getEventId()
  if (!eventId || !noShows[eventId]) return

  // Find all attendee elements with role="treeitem"
  document.querySelectorAll("div[role='treeitem']").forEach((attendeeEl) => {
    // Try to find email in this element
    const emailEl = attendeeEl.querySelector("[data-hovercard-id]")
    if (!emailEl) return

    const email = emailEl.getAttribute("data-hovercard-id")
    if (!email) return

    if (noShows[eventId] && noShows[eventId][email]) {
      // Apply no-show styling
      attendeeEl.classList.add(config.noShowClass)

      // Update button icon if it exists
      const button = attendeeEl.querySelector(`.${config.buttonClass}`)
      if (button) {
        button.dataset.status = "active"

        // Update icon and text
        const iconSpan = button.querySelector(".icon-container")
        const textSpan = button.querySelector(".text-container")

        if (iconSpan) iconSpan.innerHTML = config.icons.eye
        if (textSpan) textSpan.textContent = "Undo"

        button.setAttribute("title", "Remove No-Show")
      }
    } else {
      // Remove no-show styling
      attendeeEl.classList.remove(config.noShowClass)

      // Update button icon if it exists
      const button = attendeeEl.querySelector(`.${config.buttonClass}`)
      if (button) {
        button.dataset.status = "inactive"

        // Update icon and text
        const iconSpan = button.querySelector(".icon-container")
        const textSpan = button.querySelector(".text-container")

        if (iconSpan) iconSpan.innerHTML = config.icons.eyeOff
        if (textSpan) textSpan.textContent = "No-Show"

        button.setAttribute("title", "Mark as No-Show")
      }
    }
  })
}

// Create a no-show button
function createNoShowButton(eventId, email, name, isNoShow, attendeeEl) {
  // Create button
  const button = document.createElement("button")
  button.className = config.buttonClass
  button.setAttribute("title", isNoShow ? "Remove No-Show" : "Mark as No-Show")

  // Set button status
  button.dataset.status = isNoShow ? "active" : "inactive"

  // Create icon container
  const iconSpan = document.createElement("span")
  iconSpan.className = "icon-container"
  iconSpan.innerHTML = isNoShow ? config.icons.eye : config.icons.eyeOff

  // Create text container
  const textSpan = document.createElement("span")
  textSpan.className = "text-container"
  textSpan.textContent = isNoShow ? "Undo" : "No-Show"

  // Add icon and text to button
  button.appendChild(iconSpan)
  button.appendChild(textSpan)

  // Add click handler
  button.addEventListener("click", (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (button.dataset.status === "inactive") {
      markAsNoShow(eventId, email, name, attendeeEl)
      iconSpan.innerHTML = config.icons.eye
      textSpan.textContent = "Undo"
      button.dataset.status = "active"
      button.setAttribute("title", "Remove No-Show")
    } else {
      removeNoShow(eventId, email, attendeeEl)
      iconSpan.innerHTML = config.icons.eyeOff
      textSpan.textContent = "No-Show"
      button.dataset.status = "inactive"
      button.setAttribute("title", "Mark as No-Show")
    }
  })

  return button
}

// Add no-show buttons to attendees
function addNoShowButtons() {
  debugLog("Attempting to add No-Show buttons")

  // Get or generate event ID
  const eventId = getEventId()
  debugLog("Using event ID:", eventId)

  let buttonsAdded = 0

  // Target elements with role="treeitem" (attendee containers)
  const attendeeElements = document.querySelectorAll("div[role='treeitem']")
  debugLog(`Found ${attendeeElements.length} elements with role="treeitem"`)

  if (attendeeElements.length > 0) {
    attendeeElements.forEach((attendeeEl) => {
      // Skip if button already exists in this element
      if (attendeeEl.querySelector(`.${config.buttonClass}`)) {
        return
      }

      // Find email element within this attendee container
      const emailEl = attendeeEl.querySelector("[data-hovercard-id]")
      if (!emailEl) {
        debugLog("No email element found in attendee container")
        return
      }

      // Get email from data-hovercard-id attribute
      const email = emailEl.getAttribute("data-hovercard-id")
      if (!email || !email.includes("@")) {
        debugLog(`Skipping element with invalid email: ${email}`)
        return
      }

      // Get name from element text or use email as fallback
      const name = emailEl.textContent.trim() || email

      debugLog(`Adding button for ${name} (${email})`)

      // Check if this attendee is already marked as no-show
      const isNoShow = noShows[eventId] && noShows[eventId][email]

      // Apply initial styling if needed
      if (isNoShow) {
        attendeeEl.classList.add(config.noShowClass)
      }

      // Create button with icon and text
      const button = createNoShowButton(eventId, email, name, isNoShow, attendeeEl)

      // Add button at the end of the attendee container (treeitem div)
      attendeeEl.appendChild(button)
      buttonsAdded++
    })
  }

  debugLog(`Added ${buttonsAdded} No-Show buttons`)
}

// Check for URL changes to detect when a calendar event is opened
function checkForUrlChange() {
  if (currentUrl !== window.location.href) {
    debugLog("URL changed from", currentUrl, "to", window.location.href)
    currentUrl = window.location.href

    // Wait a moment for the DOM to update
    setTimeout(() => {
      addNoShowButtons()
      applyNoShowStyling()
    }, 1000)
  }
}

// Set up a mutation observer specifically for the attendee list
function setupAttendeeObserver() {
  // Look for common parent containers of attendee lists
  const possibleContainers = [
    document.querySelector('[role="dialog"]'), // Event dialog
    document.querySelector(".pPTZAe"), // Common attendee container class
    document.querySelector('[jsname="YPqjbf"]'), // Another possible container
  ].filter(Boolean) // Remove null/undefined values

  if (possibleContainers.length === 0) {
    // If no containers found, observe the body but with a more specific filter
    const bodyObserver = new MutationObserver((mutations) => {
      // Only process if we're in an event view
      if (!isCalendarEventView()) return

      // Check if any mutations added attendee elements
      const hasRelevantChanges = mutations.some((mutation) => {
        if (mutation.type !== "childList") return false

        // Check added nodes for treeitem roles or attendee containers
        return Array.from(mutation.addedNodes).some((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return false

          // Check if this is an attendee element or contains attendee elements
          if (node.getAttribute && node.getAttribute("role") === "treeitem") return true
          return node.querySelector && node.querySelector('div[role="treeitem"]') !== null
        })
      })

      if (hasRelevantChanges) {
        debugLog("Attendee elements added to DOM")
        addNoShowButtons()
      }
    })

    bodyObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })

    debugLog("Observing body for attendee elements")
    return
  }

  // Set up observers for each possible container
  possibleContainers.forEach((container) => {
    const observer = new MutationObserver((mutations) => {
      // Only process if we're in an event view
      if (!isCalendarEventView()) return

      // Check if any mutations added attendee elements
      const hasRelevantChanges = mutations.some((mutation) => {
        if (mutation.type !== "childList") return false

        // Check added nodes for treeitem roles
        return Array.from(mutation.addedNodes).some((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return false

          // Check if this is an attendee element or contains attendee elements
          if (node.getAttribute && node.getAttribute("role") === "treeitem") return true
          return node.querySelector && node.querySelector('div[role="treeitem"]') !== null
        })
      })

      if (hasRelevantChanges) {
        debugLog("Attendee elements added to container")
        addNoShowButtons()
      }
    })

    observer.observe(container, {
      childList: true,
      subtree: true,
    })

    debugLog("Observing container for attendee elements:", container)
  })
}

// Initialize the extension
function init() {
  debugLog("Initializing No-Show extension")
  loadNoShows()

  // Initial setup - try to add buttons right away
  setTimeout(addNoShowButtons, 1000)

  // Set up URL change detection
  setInterval(checkForUrlChange, 1000)

  // Set up a mutation observer for the entire document
  // This is less efficient but more reliable
  const observer = new MutationObserver((mutations) => {
    // Check if any mutations added potential attendee elements
    const hasRelevantChanges = mutations.some((mutation) => {
      if (mutation.type !== "childList") return false

      // Look for added nodes that might be or contain attendee elements
      return Array.from(mutation.addedNodes).some((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return false

        // Check if this is a treeitem or contains treeitems
        if (node.getAttribute && node.getAttribute("role") === "treeitem") return true
        if (node.querySelector && node.querySelector('div[role="treeitem"]')) return true

        // Check if this has or contains elements with data-hovercard-id
        if (node.hasAttribute && node.hasAttribute("data-hovercard-id")) return true
        if (node.querySelector && node.querySelector("[data-hovercard-id]")) return true

        return false
      })
    })

    if (hasRelevantChanges) {
      debugLog("Relevant DOM changes detected")
      setTimeout(() => {
        addNoShowButtons()
      }, 500)
    }
  })

  // Observe the entire document but with a filter for relevant changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  // Listen for history changes (for single-page app navigation)
  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState

  history.pushState = function () {
    originalPushState.apply(this, arguments)
    debugLog("History pushState detected")
    setTimeout(() => {
      currentUrl = window.location.href
      addNoShowButtons()
    }, 1000)
  }

  history.replaceState = function () {
    originalReplaceState.apply(this, arguments)
    debugLog("History replaceState detected")
    setTimeout(() => {
      currentUrl = window.location.href
      addNoShowButtons()
    }, 1000)
  }

  // Listen for popstate events (back/forward navigation)
  window.addEventListener("popstate", () => {
    debugLog("Popstate event detected")
    setTimeout(() => {
      currentUrl = window.location.href
      addNoShowButtons()
    }, 1000)
  })

  // Add a periodic check as a fallback
  // This is less frequent than before but ensures buttons are added
  setInterval(() => {
    const attendeeElements = document.querySelectorAll("div[role='treeitem']")
    const buttonsExist = document.querySelectorAll(`.${config.buttonClass}`).length > 0

    if (attendeeElements.length > 0 && !buttonsExist) {
      debugLog("Periodic check: Found attendees without buttons")
      addNoShowButtons()
    }
  }, 5000) // Check every 5 seconds
}

// Declare chrome if it's not already defined
if (typeof chrome === "undefined") {
  var chrome = {}
}

// Run when DOM is fully loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}

// Listen for messages from popup or background script
if (typeof chrome !== "undefined" && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getNoShows") {
      sendResponse(noShows)
    } else if (message.action === "forceRefresh") {
      addNoShowButtons()
      sendResponse({ success: true })
    } else if (message.action === "toggleDebug") {
      config.debug = !config.debug
      debugLog("Debug mode " + (config.debug ? "enabled" : "disabled"))
      sendResponse({ debug: config.debug })
    } else if (message.action === "getDebugStatus") {
      sendResponse({ debug: config.debug })
    }
  })
}

// Add a manual trigger for debugging
window.addNoShowButtons = addNoShowButtons
window.toggleDebug = () => {
  config.debug = !config.debug
  console.log("Debug mode " + (config.debug ? "enabled" : "disabled"))
  return config.debug
}
