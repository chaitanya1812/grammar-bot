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
            
        case 'checkGrammar':
            checkGrammar(request.data).then(sendResponse).catch(error => {
                sendResponse({ error: error.message });
            });
            return true; // Keep message channel open for async response
            
        case 'loadFeatures':
            loadFeatures().then(sendResponse).catch(error => {
                sendResponse({ error: error.message });
            });
            return true; // Keep message channel open for async response
            
        case 'logError':
            console.error('Content script error:', request.error);
            break;
    }
});

// Function to check if backend is running
async function checkBackendStatus() {
    try {
        const response = await fetch('http://127.0.0.1:8000/', {
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

// Function to proxy grammar check requests
async function checkGrammar(data) {
    try {
        console.log('Background: Making grammar check request with data:', data);
        
        const response = await fetch('http://127.0.0.1:8000/check-grammar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: data.text,
                feature: data.feature || 'grammar_check'
            }),
            signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        console.log('Background: Response received:', response);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Background: Parsed response:', result);
        
        return result;

    } catch (error) {
        console.error('Background: Grammar check failed:', error);
        throw error;
    }
}

// Function to proxy features loading
async function loadFeatures() {
    try {
        console.log('Background: Loading features from backend');
        
        const response = await fetch('http://127.0.0.1:8000/features', {
            method: 'GET',
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Background: Features loaded:', result);
        
        return result;

    } catch (error) {
        console.error('Background: Failed to load features:', error);
        throw error;
    }
}

// Periodic health check
setInterval(async () => {
    const status = await checkBackendStatus();
    if (status.status === 'offline') {
        console.warn('Grammar Bot backend is offline');
    }
}, 60000); // Check every minute 