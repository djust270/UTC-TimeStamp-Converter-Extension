// Content script for timestamp conversion
class TimestampConverter {
    constructor() {
        this.originalTimestamps = new Map(); // Store original values for potential reversal
        this.converted = false;
    }
    
    // Common timestamp patterns (UTC)
    getTimestampPatterns() {
        return [
            // ISO 8601 formats
            /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z/g,
            /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:\+00:00|UTC)/g,
            
            // Unix timestamps (10 digits for seconds, 13 for milliseconds)
            /\b1[0-9]{9}\b/g, // Unix timestamp in seconds (starts with 1, 10 digits)
            /\b1[0-9]{12}\b/g, // Unix timestamp in milliseconds (starts with 1, 13 digits)
            
            // Common date formats that might be UTC (but not already converted with timezone)
            /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{3})?\s*(?:UTC|GMT)(?!\s+\w+)/g,
            /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}\s*(?:UTC|GMT)(?!\s+\w+)/g,
            /\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}\s*(?:UTC|GMT)(?!\s+\w+)/g,
            
            // 12-hour format with AM/PM - but NOT already converted (no timezone abbreviation after)
            /\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2} (?:AM|PM)(?!\s+\w+)/gi,
            /\d{1,2}\/\d{1,2}\/\d{2}, \d{1,2}:\d{2} (?:AM|PM)(?!\s+\w+)/gi, // Short year format with comma
            
            // RFC 2822 format
            /[A-Za-z]{3},?\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+(?:GMT|UTC)/g
        ];
    }
    
    parseTimestamp(timestampStr) {
        const cleaned = timestampStr.trim();
        console.log(`Parsing timestamp: "${cleaned}"`);
        
        // ISO 8601 with Z or UTC
        if (cleaned.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|UTC|\+00:00)/)) {
            return new Date(cleaned.replace('UTC', 'Z'));
        }
        
        // Unix timestamp detection
        if (/^\d{10}$/.test(cleaned)) {
            return new Date(parseInt(cleaned) * 1000);
        }
        
        if (/^\d{13}$/.test(cleaned)) {
            return new Date(parseInt(cleaned));
        }
        
        // Standard date formats (assume UTC if no timezone specified)
        const dateFormats = [
            // 24-hour formats
            /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(?:\s*(?:UTC|GMT))?$/,
            /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\s*(?:UTC|GMT))?$/,
            /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\s*(?:UTC|GMT))?$/,
            
            // 12-hour formats with AM/PM - Updated to match the actual format
            /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}) (AM|PM)(?:\s*(?:UTC|GMT))?$/i,
            /^(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}):(\d{2}) (AM|PM)(?:\s*(?:UTC|GMT))?$/i,
            /^(\d{1,2})\/(\d{1,2})\/(\d{2}), (\d{1,2}):(\d{2}) (AM|PM)(?:\s*(?:UTC|GMT))?$/i // Short year with comma
        ];
        
        for (let i = 0; i < dateFormats.length; i++) {
            const format = dateFormats[i];
            const match = cleaned.match(format);
            console.log(`Testing format ${i}: ${format.source} - Match:`, match);
            
            if (match) {
                console.log('Match found:', match);
                // Parse as UTC
                if (match[6] && (match[6].toUpperCase() === 'AM' || match[6].toUpperCase() === 'PM')) {
                    // 12-hour format with AM/PM
                    let hour = parseInt(match[4]);
                    const minute = match[5];
                    const ampm = match[6].toUpperCase();
                    
                    console.log(`Converting 12-hour time: ${hour}:${minute} ${ampm}`);
                    
                    // Convert to 24-hour format
                    if (ampm === 'AM' && hour === 12) {
                        hour = 0;
                    } else if (ampm === 'PM' && hour !== 12) {
                        hour += 12;
                    }
                    
                    const hourStr = hour.toString().padStart(2, '0');
                    
                    // Handle both 4-digit and 2-digit years
                    let year = match[3];
                    if (year.length === 2) {
                        // Convert 2-digit year to 4-digit (assume 20xx for years 00-99)
                        year = '20' + year;
                    }
                    
                    // MM/DD/YYYY format
                    const isoString = `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}T${hourStr}:${minute}:00Z`;
                    console.log(`Created ISO string: ${isoString}`);
                    const result = new Date(isoString);
                    console.log(`Parsed date object: ${result}`);
                    return result;
                } else if (format.source.includes('(\\d{4})')) {
                    // YYYY-MM-DD format
                    return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`);
                } else {
                    // MM/DD/YYYY or DD-MM-YYYY format (assume MM/DD for now)
                    return new Date(`${match[3]}-${match[1]}-${match[2]}T${match[4]}:${match[5]}:${match[6]}Z`);
                }
            }
        }
        
        // Try parsing as-is and assume UTC
        const date = new Date(cleaned + (cleaned.includes('Z') || cleaned.includes('UTC') || cleaned.includes('GMT') ? '' : ' UTC'));
        console.log(`Fallback parse result: ${date}`);
        return isNaN(date.getTime()) ? null : date;
    }
    
    formatTimestamp(date, timezone, originalText = '') {
        try {
            const options = {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            };
            
            const formatter = new Intl.DateTimeFormat('en-US', options);
            const parts = formatter.formatToParts(date);
            
            const year = parts.find(p => p.type === 'year').value;
            const month = parts.find(p => p.type === 'month').value;
            const day = parts.find(p => p.type === 'day').value;
            const hour = parts.find(p => p.type === 'hour').value;
            const minute = parts.find(p => p.type === 'minute').value;
            const second = parts.find(p => p.type === 'second').value;
            
            // Get timezone abbreviation
            const shortFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                timeZoneName: 'short'
            });
            const timeZoneName = shortFormatter.formatToParts(date).find(p => p.type === 'timeZoneName')?.value || timezone;
            
            // For AM/PM format timestamps, return in 12-hour format to match original style
            const originalHasAMPM = originalText && /\d{1,2}:\d{2} (?:AM|PM)/i.test(originalText);
            
            if (originalHasAMPM) {
                const hour12Options = { ...options, hour12: true };
                delete hour12Options.second; // Remove seconds for AM/PM format
                
                const hour12Formatter = new Intl.DateTimeFormat('en-US', hour12Options);
                const hour12Parts = hour12Formatter.formatToParts(date);
                
                const year12 = hour12Parts.find(p => p.type === 'year').value;
                const month12 = hour12Parts.find(p => p.type === 'month').value;
                const day12 = hour12Parts.find(p => p.type === 'day').value;
                const hour12 = hour12Parts.find(p => p.type === 'hour').value;
                const minute12 = hour12Parts.find(p => p.type === 'minute').value;
                const dayPeriod = hour12Parts.find(p => p.type === 'dayPeriod').value;
                
                return `${month12}/${day12}/${year12} ${hour12}:${minute12} ${dayPeriod} ${timeZoneName}`;
            }
            
            return `${year}-${month}-${day} ${hour}:${minute}:${second} ${timeZoneName}`;
        } catch (error) {
            console.error('Error formatting timestamp:', error);
            return date.toString();
        }
    }
    
    findAndConvertTimestamps(timezone) {
        const patterns = this.getTimestampPatterns();
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // Skip script and style elements
                    const parent = node.parentElement;
                    if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
        
        let convertedCount = 0;
        
        console.log(`Processing ${textNodes.length} text nodes`);
        
        textNodes.forEach(textNode => {
            let text = textNode.textContent;
            let hasChanges = false;
            const originalText = text;
            
            // Skip if this node has already been processed
            if (this.originalTimestamps.has(textNode)) {
                return;
            }
            
            patterns.forEach((pattern, index) => {
                const matches = text.match(pattern);
                if (matches) {
                    console.log(`Pattern ${index} found matches:`, matches);
                }
                
                text = text.replace(pattern, (match) => {
                    console.log(`Attempting to parse: "${match}"`);
                    const parsedDate = this.parseTimestamp(match);
                    if (parsedDate && !isNaN(parsedDate.getTime())) {
                        console.log(`Successfully parsed: ${match} -> ${parsedDate}`);
                        // Store original if not already stored
                        if (!this.originalTimestamps.has(textNode)) {
                            this.originalTimestamps.set(textNode, textNode.textContent);
                        }
                        
                        const converted = this.formatTimestamp(parsedDate, timezone, match);
                        console.log(`Converted to: ${converted}`);
                        hasChanges = true;
                        convertedCount++;
                        return converted;
                    } else {
                        console.log(`Failed to parse: "${match}"`);
                    }
                    return match;
                });
            });
            
            if (hasChanges) {
                console.log(`Updating text node from: "${originalText}" to: "${text}"`);
                textNode.textContent = text;
            }
        });
        
        console.log(`Total converted: ${convertedCount}`);
        this.converted = true;
        return convertedCount;
    }
    
    async checkAutoConvert() {
        console.log('Checking auto-convert for domain:', window.location.hostname);
        
        try {
            const { rememberedSites = [], selectedTimezone } = await chrome.storage.sync.get(['rememberedSites', 'selectedTimezone']);
            const currentDomain = window.location.hostname;
            
            console.log('Current domain:', currentDomain);
            console.log('Remembered sites:', rememberedSites);
            console.log('Selected timezone:', selectedTimezone);
            
            if (rememberedSites.includes(currentDomain) && selectedTimezone) {
                const timeout = 4000;
                const timeoutDisplay = timeout / 1000;
                console.log('Domain is remembered, starting auto-conversion in ' + timeoutDisplay + ' seconds...');
                setTimeout(() => {
                    console.log('Executing auto-conversion now');
                    const count = this.findAndConvertTimestamps(selectedTimezone);
                    console.log(`Auto-converted ${count} timestamps`);
                }, timeout);
            } else {
                console.log('No auto-conversion needed - domain not remembered or no timezone set');
            }
        } catch (error) {
            console.error('Error in checkAutoConvert:', error);
        }
    }
}

const converter = new TimestampConverter();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'convertTimestamps') {
        try {
            const count = converter.findAndConvertTimestamps(request.timezone);
            sendResponse({ success: true, count });
        } catch (error) {
            console.error('Content script error:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true; // Keep message channel open for async response
    }
});

// Auto-convert for remembered sites
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => converter.checkAutoConvert());
} else {
    converter.checkAutoConvert();
}

// Signal that content script is loaded
console.log('Timezone Converter content script loaded');