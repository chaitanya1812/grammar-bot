// Background service worker for Grammar Bot

chrome.runtime.onInstalled.addListener((details) => {
    console.log('Grammar Bot installed:', details.reason);
    
    if (details.reason === 'install') {
        // Show welcome notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Grammar Bot Installed!',
            message: 'Select text on any webpage to check grammar with AI.'
        });
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // Open popup or perform action
    console.log('Grammar Bot icon clicked for tab:', tab.id);
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    switch (request.action) {
        case 'checkBackendStatus':
            checkBackendStatus().then(sendResponse);
            return true; // Keep message channel open for async response
            
        case 'logError':
            console.error('Content script error:', request.error);
            break;
    }
});

// Function to check if backend is running
async function checkBackendStatus() {
    try {
        const response = await fetch('http://localhost:8000/', {
            method: 'GET',
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        return {
            status: 'online',
            message: 'Backend is running'
        };
    } catch (error) {
        return {
            status: 'offline',
            message: 'Backend is not running. Please start the Grammar Bot server.'
        };
    }
}

// Periodic health check
setInterval(async () => {
    const status = await checkBackendStatus();
    if (status.status === 'offline') {
        console.warn('Grammar Bot backend is offline');
    }
}, 60000); // Check every minute 