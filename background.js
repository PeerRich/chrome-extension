// Background script for the extension

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Calendar No-Show Tracker installed")
})

// Check for Cal.com cookie
function checkCalComCookie(callback) {
  chrome.cookies.get(
    {
      url: "https://cal.com",
      name: "__Secure-next-auth.session-token",
    },
    (cookie) => {
      callback(cookie !== null)
    },
  )
}

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "clearAllNoShows") {
    chrome.storage.sync.set({ calendarNoShows: {} }, () => {
      sendResponse({ success: true })
    })
    return true // Indicates async response
  } else if (message.action === "checkCalComLogin") {
    checkCalComCookie((isLoggedIn) => {
      sendResponse({ isLoggedIn: isLoggedIn })
    })
    return true // Indicates async response
  }
})
