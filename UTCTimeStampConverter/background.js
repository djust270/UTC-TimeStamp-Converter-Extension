// Background script for the timezone converter extension

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Timezone Converter extension installed');
    
    // Set default timezone to user's system timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    chrome.storage.sync.set({ 
        selectedTimezone: userTimezone,
        rememberedSites: []
    });
});

// Handle tab updates to auto-convert for remembered sites
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only trigger when page is completely loaded
    if (changeInfo.status === 'complete' && tab.url) {
        try {
            const url = new URL(tab.url);
            const domain = url.hostname;
            
            // Check if this domain is in remembered sites
            chrome.storage.sync.get(['rememberedSites', 'selectedTimezone'], (result) => {
                const { rememberedSites = [], selectedTimezone } = result;
                
                if (rememberedSites.includes(domain) && selectedTimezone) {
                    // Send message to content script to auto-convert
                    chrome.tabs.sendMessage(tabId, {
                        action: 'convertTimestamps',
                        timezone: selectedTimezone
                    }).catch(error => {
                        // Silently handle error - content script might not be ready
                        console.log('Auto-conversion not triggered:', error.message);
                    });
                }
            });
        } catch (error) {
            // Invalid URL, ignore
            console.log('Invalid URL for auto-conversion:', error.message);
        }
    }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSettings') {
        chrome.storage.sync.get(['selectedTimezone', 'rememberedSites'], (result) => {
            sendResponse(result);
        });
        return true;
    }
});

// Context menu for quick access (optional)
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'convertTimestamps',
        title: 'Convert timestamps on this page',
        contexts: ['page']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'convertTimestamps') {
        chrome.storage.sync.get(['selectedTimezone'], (result) => {
            if (result.selectedTimezone) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'convertTimestamps',
                    timezone: result.selectedTimezone
                });
            }
        });
    }
});