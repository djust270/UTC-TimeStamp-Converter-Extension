document.addEventListener('DOMContentLoaded', async () => {
    const timezoneSelect = document.getElementById('timezoneSelect');
    const convertBtn = document.getElementById('convertBtn');
    const rememberBtn = document.getElementById('rememberBtn');
    const status = document.getElementById('status');
    const sitesList = document.getElementById('sitesList');
    
    // Load saved timezone preference
    const result = await chrome.storage.sync.get(['selectedTimezone']);
    if (result.selectedTimezone) {
        timezoneSelect.value = result.selectedTimezone;
    } else {
        // Default to user's system timezone if available
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const option = Array.from(timezoneSelect.options).find(opt => opt.value === userTimezone);
        if (option) {
            timezoneSelect.value = userTimezone;
        }
    }
    
    // Save timezone preference when changed
    timezoneSelect.addEventListener('change', () => {
        chrome.storage.sync.set({ selectedTimezone: timezoneSelect.value });
    });
    
    // Convert timestamps on current page
    convertBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        try {
            // First, try to inject the content script in case it's not loaded
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
            } catch (injectionError) {
                // Content script might already be loaded, that's okay
                console.log('Content script injection note:', injectionError.message);
            }
            
            // Small delay to ensure content script is ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'convertTimestamps',
                timezone: timezoneSelect.value
            });
            
            if (response && response.success) {
                showStatus(`Converted ${response.count} timestamps successfully!`, 'success');
            } else {
                showStatus('No timestamps found on this page', 'error');
            }
        } catch (error) {
            console.error('Conversion error:', error);
            showStatus('Error: ' + error.message, 'error');
        }
    });
    
    // Remember current site for auto-conversion
    rememberBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = new URL(tab.url);
        const domain = url.hostname;
        
        const { rememberedSites = [] } = await chrome.storage.sync.get(['rememberedSites']);
        
        if (!rememberedSites.includes(domain)) {
            rememberedSites.push(domain);
            await chrome.storage.sync.set({ rememberedSites });
            showStatus(`Added ${domain} to remembered sites`, 'success');
            loadRememberedSites();
        } else {
            showStatus(`${domain} is already remembered`, 'error');
        }
    });
    
    function showStatus(message, type) {
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';
        
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }
    
    async function loadRememberedSites() {
        const { rememberedSites = [] } = await chrome.storage.sync.get(['rememberedSites']);
        
        sitesList.innerHTML = '';
        
        if (rememberedSites.length === 0) {
            sitesList.innerHTML = '<div style="color: #666; font-style: italic;">None</div>';
            return;
        }
        
        rememberedSites.forEach(site => {
            const siteItem = document.createElement('div');
            siteItem.className = 'site-item';
            siteItem.innerHTML = `
                <span>${site}</span>
                <button class="remove-site" data-site="${site}">Remove</button>
            `;
            sitesList.appendChild(siteItem);
        });
        
        // Add event listeners for remove buttons
        sitesList.querySelectorAll('.remove-site').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const siteToRemove = e.target.dataset.site;
                const { rememberedSites = [] } = await chrome.storage.sync.get(['rememberedSites']);
                const updatedSites = rememberedSites.filter(site => site !== siteToRemove);
                await chrome.storage.sync.set({ rememberedSites: updatedSites });
                loadRememberedSites();
                showStatus(`Removed ${siteToRemove}`, 'success');
            });
        });
    }
    
    // Load remembered sites on popup open
    loadRememberedSites();
});