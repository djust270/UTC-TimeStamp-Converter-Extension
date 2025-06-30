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
        console.log('Tab updated:', tab.url, 'Status:', changeInfo.status);
        
        try {
            const url = new URL(tab.url);
            const domain = url.hostname;
            console.log('Checking domain for auto-conversion:', domain);
            
            // Check if this domain is in remembered sites
            chrome.storage.sync.get(['rememberedSites', 'selectedTimezone'], (result) => {
                const { rememberedSites = [], selectedTimezone } = result;
                console.log('Background - Remembered sites:', rememberedSites);
                console.log('Background - Selected timezone:', selectedTimezone);
                
                if (rememberedSites.includes(domain) && selectedTimezone) {
                    console.log('Background - Domain is remembered, sending auto-convert message');
                    
                    // Wait a bit longer for content to load
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tabId, {
                            action: 'convertTimestamps',
                            timezone: selectedTimezone
                        }).then(response => {
                            console.log('Background - Auto-conversion response:', response);
                        }).catch(error => {
                            console.log('Background - Auto-conversion error:', error.message);
                        });
                    }, 3000); // Longer delay for complex pages
                } else {
                    console.log('Background - No auto-conversion needed for domain:', domain);
                }
            });
        } catch (error) {
            console.log('Background - Invalid URL for auto-conversion:', error.message);
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