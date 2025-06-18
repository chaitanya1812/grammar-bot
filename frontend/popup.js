// Popup JavaScript for Grammar Bot

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize popup
    await initializePopup();
    
    // Set up event listeners
    setupEventListeners();
    
    // Check backend status
    await checkBackendStatus();
    
    // Load user settings
    loadSettings();
});

async function initializePopup() {
    console.log('Grammar Bot popup initialized');
    
    // Load features from backend
    try {
        const response = await fetch('http://localhost:8000/features');
        const data = await response.json();
        updateFeaturesDisplay(data.features);
    } catch (error) {
        console.error('Failed to load features:', error);
    }
}

function setupEventListeners() {
    // Settings checkboxes
    const autoCheckbox = document.getElementById('autoCheck');
    const toastCheckbox = document.getElementById('showToasts');
    
    autoCheckbox?.addEventListener('change', (e) => {
        saveSettings({ autoCheck: e.target.checked });
    });
    
    toastCheckbox?.addEventListener('change', (e) => {
        saveSettings({ showToasts: e.target.checked });
    });
}

async function checkBackendStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const backendStatusText = document.querySelector('.backend-status-text');
    
    try {
        const response = await fetch('http://localhost:8000/', {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
            // Backend is online
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Online';
            backendStatusText.textContent = 'Connected';
            backendStatusText.className = 'backend-status-text online';
        } else {
            throw new Error('Backend responded with error');
        }
    } catch (error) {
        // Backend is offline
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Offline';
        backendStatusText.textContent = 'Disconnected';
        backendStatusText.className = 'backend-status-text offline';
        
        console.error('Backend connection failed:', error);
    }
}

function updateFeaturesDisplay(features) {
    const featureList = document.querySelector('.feature-list');
    if (!featureList || !features) return;
    
    featureList.innerHTML = '';
    
    features.forEach(feature => {
        const featureItem = document.createElement('div');
        featureItem.className = `feature-item ${feature.enabled ? 'enabled' : 'disabled'}`;
        
        featureItem.innerHTML = `
            <span class="feature-icon">${feature.icon}</span>
            <span class="feature-name">${feature.name}</span>
            <span class="feature-status">${feature.enabled ? 'Active' : 'Coming Soon'}</span>
        `;
        
        featureList.appendChild(featureItem);
    });
}

function loadSettings() {
    chrome.storage.sync.get(['autoCheck', 'showToasts'], (result) => {
        const autoCheck = document.getElementById('autoCheck');
        const showToasts = document.getElementById('showToasts');
        
        if (autoCheck) {
            autoCheck.checked = result.autoCheck !== false; // Default to true
        }
        
        if (showToasts) {
            showToasts.checked = result.showToasts !== false; // Default to true
        }
    });
}

function saveSettings(settings) {
    chrome.storage.sync.set(settings, () => {
        console.log('Settings saved:', settings);
        
        // Send message to content script to update settings
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'updateSettings',
                    settings: settings
                });
            }
        });
    });
}

// Refresh backend status every 10 seconds
setInterval(checkBackendStatus, 10000); 