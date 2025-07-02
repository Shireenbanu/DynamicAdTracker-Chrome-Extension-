// content.js - Enhanced Ad Detector for Individual Screenshots

// ============================================================================
// CONFIGURATION - Ad Detection Patterns
// ============================================================================
const AD_SIGNATURES = {
    // Direct ad platform identifiers
    adServerPatterns: [
      /ads?\.(doubleclick|google|facebook|amazon)\./i,
      /(googleads|doubleclick)\.g\.doubleclick\.net/i,
      /pagead2\.googlesyndication\.com/i,
      /adservice\.google\./i,
      /securepubads\.g\.doubleclick\.net/i,
      /tpc\.googlesyndication\.com/i
    ],
    
    // Known HTML patterns/selectors for ads
    definitiveSelectors: [
      'iframe[src*="ads"]',
      'div[data-ad-unit]',
      'div[data-ad-client]',
      'div[data-ad-slot]',
      'div[data-testid="ad"]',
      'div[aria-label*="Ad"]',
      'ins.adsbygoogle',
      'div[id^="google_ads_iframe"]',
      'div[id^="div-gpt-ad"]',
      'div[class*="AdContainer"]',
      'div[class*="ad-container"]',
      'div[class*="advertisement"]'
    ]
};

// Global storage for detected ads
let detectedAds = [];

// ============================================================================
// AD DETECTION FUNCTIONS
// ============================================================================

/**
 * Check if an element is definitively an ad
 * @param {Element} element - DOM element to check
 * @returns {boolean} - true if element is an ad
 */
function isDefinitiveAd(element) {
    // Check iframe sources
    if (element.tagName === 'IFRAME') {
      const src = element.getAttribute('src') || '';
      return AD_SIGNATURES.adServerPatterns.some(pattern => pattern.test(src));
    }
    
    // Check data attributes
    if (element.hasAttribute('data-ad-unit') ||
        element.hasAttribute('data-ad-client') ||
        element.hasAttribute('data-ad-slot')) {
      return true;
    }
    
    // Check selectors
    return AD_SIGNATURES.definitiveSelectors.some(selector => {
      try {
        return element.matches(selector);
      } catch (e) {
        return false;
      }
    });
}

// ============================================================================
// ENHANCED FUNCTIONS FOR SCREENSHOT WORKFLOW
// ============================================================================

/**
 * Get all ads on the page with detailed information
 * This function is called by background.js via executeScript
 */
function getAllAdsForScreenshots() {
    console.log('Getting all ads for screenshot workflow...');
    
    // Find all potential ad elements using CSS selector
    const candidates = document.querySelectorAll(`
      iframe[src*="ads"],
      iframe[src*="doubleclick"],
      iframe[src*="googlesyndication"],
      div[data-ad-unit],
      div[data-ad-client],
      div[data-ad-slot],
      div[data-testid*="ad"],
      div[aria-label*="ad" i],
      ins.adsbygoogle,
      div[id^="google_ads_iframe"],
      div[id^="div-gpt-ad"],
      div[class*="AdContainer"],
      div[class*="ad-container"],
      div[class*="advertisement"]
    `);
    
    const ads = [];
    let adIndex = 0;

      
    candidates.forEach(element => {
        if (isDefinitiveAd(element)) {
            const rect = element.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
            
            // Only process elements with valid dimensions
            if (rect.width > 0 && rect.height > 0) {
                // Mark element for later reference
                element.setAttribute('data-ad-screenshot-index', adIndex);
                
                const adData = {
                    index: adIndex,
                    // Absolute position on page (includes scroll)
                    absoluteX: Math.round(rect.left + scrollLeft),
                    absoluteY: Math.round(rect.top + scrollTop),
                    // Current viewport position
                    viewportX: Math.round(rect.left),
                    viewportY: Math.round(rect.top),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    // Element details
                    tagName: element.tagName,
                    className: element.className || '',
                    id: element.id || '',
                    src: element.src || element.getAttribute('data-src') || '',
                    text: element.textContent?.substring(0, 100) || '',
                    // Visibility info
                    isCurrentlyVisible: rect.top >= 0 && rect.bottom <= window.innerHeight && 
                                       rect.left >= 0 && rect.right <= window.innerWidth,
                    // Device pixel ratio for high-DPI screens
                    dpr: window.devicePixelRatio || 1

                };
                
                ads.push(adData);
                console.log(`Found ad ${adIndex}:`, adData);
                adIndex++;
            } else {
                console.log('Skipping ad element with invalid dimensions:', element);
            }
        }
    });
    
    console.log(`Total ads found: ${ads.length}`);
    detectedAds = ads; // Store globally for later use
    return ads;
}

/**
 * Get updated position of a specific ad after scrolling
 * Called by background.js after scrolling to bring ad into view
 */
function getUpdatedAdPosition(adIndex) {
    const element = document.querySelector(`[data-ad-screenshot-index="${adIndex}"]`);
    if (!element) {
        console.log(`Element with ad-screenshot-index ${adIndex} not found`);
        return null;
    }

    const rect = element.getBoundingClientRect();
    
    // Check if element is actually visible in viewport
    const isVisible = rect.top >= 0 && 
                     rect.left >= 0 && 
                     rect.bottom <= window.innerHeight && 
                     rect.right <= window.innerWidth;

    const isPartiallyVisible = rect.bottom > 0 && 
                              rect.top < window.innerHeight &&
                              rect.right > 0 && 
                              rect.left < window.innerWidth;

    const position = {
        // Position within the screenshot (viewport coordinates)
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        isVisible: isVisible,
        isPartiallyVisible: isPartiallyVisible,
        // Additional context
        centerX: Math.round(rect.left + rect.width / 2),
        centerY: Math.round(rect.top + rect.height / 2),
        // Viewport info
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        // Element details
        tagName: element.tagName,
        id: element.id || '',
        className: element.className || ''
    };

    console.log(`Updated position for ad ${adIndex}:`, position);
    return position;
}

/**
 * Scroll to a specific position
 */
function scrollToPosition(yPosition) {
    console.log(`Scrolling to position: ${yPosition}`);
    window.scrollTo({
        top: yPosition,
        behavior: 'instant'
    });
}

/**
 * Scroll to bring a specific ad into view (centered if possible)
 */
function scrollToAd(adIndex) {
    const element = document.querySelector(`[data-ad-screenshot-index="${adIndex}"]`);
    if (!element) {
        console.log(`Cannot scroll to ad ${adIndex} - element not found`);
        return false;
    }

    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Calculate target scroll position to center the ad
    const elementAbsoluteY = rect.top + scrollTop;
    const targetScrollY = Math.max(0, elementAbsoluteY - (window.innerHeight / 2));
    
    console.log(`Scrolling to center ad ${adIndex} at position ${targetScrollY}`);
    scrollToPosition(targetScrollY);
    return true;
}

// ============================================================================
// HIGHLIGHTING FUNCTIONS (Enhanced)
// ============================================================================

/**
 * Add visual highlight to an ad element
 * @param {Element} element - DOM element to highlight
 * @param {number} adIndex - Index of the ad for labeling
 */
function highlightAd(element, adIndex = null) {
    if (element._adHighlighted) return;
    element._adHighlighted = true;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'ad-detector-overlay';
    overlay.style.cssText = `
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      border: 2px solid #ff0000 !important;
      z-index: 999999 !important;
      pointer-events: none !important;
      box-sizing: border-box !important;
      background: rgba(255, 0, 0, 0.1) !important;
    `;
    
    // Create label
    const label = document.createElement('div');
    label.className = 'ad-detector-label';
    label.textContent = adIndex !== null ? `AD ${adIndex + 1}` : 'AD';
    label.style.cssText = `
      position: absolute !important;
      top: -2px !important;
      right: -2px !important;
      background: #ff0000 !important;
      color: white !important;
      padding: 2px 6px !important;
      font-size: 10px !important;
      font-family: Arial, sans-serif !important;
      font-weight: bold !important;
      line-height: 1 !important;
      z-index: 1000000 !important;
      border-radius: 0 0 0 3px !important;
    `;
    
    overlay.appendChild(label);
    
    // Ensure element can contain absolutely positioned overlay
    if (getComputedStyle(element).position === 'static') {
      element.style.position = 'relative';
    }
    
    element.appendChild(overlay);
    element._adOverlay = overlay;
}

/**
 * Remove all ad highlights
 */
function removeAllHighlights() {
    const overlays = document.querySelectorAll('.ad-detector-overlay');
    overlays.forEach(overlay => overlay.remove());
    
    // Reset highlighted flag
    document.querySelectorAll('[data-ad-screenshot-index]').forEach(element => {
        element._adHighlighted = false;
        element._adOverlay = null;
    });
}

/**
 * Highlight all detected ads
 */
function highlightAllAds() {
    detectedAds.forEach((ad, index) => {
        const element = document.querySelector(`[data-ad-screenshot-index="${index}"]`);
        if (element) {
            highlightAd(element, index);
        }
    });
}

// ============================================================================
// LEGACY SCANNING FUNCTION (for backward compatibility)
// ============================================================================

/**
 * Original scan function - now enhanced to work with screenshot workflow
 */
function scanForAds() {
    console.log('Running legacy ad scan...');
    const ads = getAllAdsForScreenshots();
    
    // Highlight all found ads
    highlightAllAds();
    
    // Send results to background script using legacy format
    if (ads.length > 0) {
        const legacyFormat = ads.map(ad => ({
            top: ad.viewportY,
            left: ad.viewportX,
            width: ad.width,
            height: ad.height,
            dpr: ad.dpr
        }));
        
        console.log('Sending ad elements (legacy format):', legacyFormat);
        chrome.runtime.sendMessage({ adElements: legacyFormat }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending message:', chrome.runtime.lastError);
            } else {
                console.log("Got response:", response);
            }
        });
    } else {
        console.log('No valid ad elements found');
    }
}

// ============================================================================
// MESSAGE LISTENER (for background script communication)
// ============================================================================

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    switch (request.action) {
        case 'getAllAds':
            const ads = getAllAdsForScreenshots();
            sendResponse({ ads: ads });
            break;
            
        case 'getAdPosition':
            const position = getUpdatedAdPosition(request.adIndex);
            sendResponse({ position: position });
            break;
            
        case 'scrollToPosition':
            scrollToPosition(request.yPosition);
            sendResponse({ success: true });
            break;
            
        case 'scrollToAd':
            const success = scrollToAd(request.adIndex);
            sendResponse({ success: success });
            break;
            
        case 'highlightAds':
            highlightAllAds();
            sendResponse({ success: true });
            break;
            
        case 'removeHighlights':
            removeAllHighlights();
            sendResponse({ success: true });
            break;
            
        case 'scanAds':
            scanForAds();
            sendResponse({ success: true });
            break;
            
        default:
            console.log('Unknown action:', request.action);
            sendResponse({ error: 'Unknown action' });
    }
    
    return true; // Keep message channel open for async responses
});

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize ad detection system
 */
function initializeAdDetection() {
    console.log('Initializing enhanced ad detection...');
    
    // Wait for ads to load, then do initial scan
    setTimeout(() => {
        console.log('Starting initial ad scan...');
        scanForAds();
    }, 5000);
}

// ============================================================================
// AUTO-START WHEN DOM IS READY
// ============================================================================

// Start detection when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdDetection);
} else {
    initializeAdDetection();
}

// ============================================================================
// UTILITY FUNCTIONS (exposed globally for background script)
// ============================================================================

// Make functions available globally for executeScript
window.getAllAdsForScreenshots = getAllAdsForScreenshots;
window.getUpdatedAdPosition = getUpdatedAdPosition;
window.scrollToPosition = scrollToPosition;
window.scrollToAd = scrollToAd;