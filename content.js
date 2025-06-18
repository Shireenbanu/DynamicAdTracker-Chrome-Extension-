// content.js - Static Ad Detector (Organized)

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
  // HIGHLIGHTING FUNCTIONS
  // ============================================================================
  
  /**
   * Add visual highlight to an ad element
   * @param {Element} element - DOM element to highlight
   */
  function highlightAd(element) {
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
    label.textContent = 'AD';
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
  
  // ============================================================================
  // MAIN SCANNING FUNCTION
  // ============================================================================
  
  /**
   * Scan the page for ads, extract coordinates, and highlight them
   */
  function scanForAds() {
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
    
    const adElements = [];
    
    // Process each candidate element
    candidates.forEach(element => {
      if (isDefinitiveAd(element)) {
        console.log('Found ad element:', element);
        
        const rect = element.getBoundingClientRect();
        console.log('Element coordinates:', rect);
        
        // Only process elements with valid dimensions
        if (rect.width > 0 && rect.height > 0) {
          const adPosition = {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            dpr: window.devicePixelRatio
          };
          
          adElements.push(adPosition);
          highlightAd(element);
        } else {
          console.warn('Skipping element with invalid dimensions:', element);
        }
      }
    });
    
    // Send results to background script if ads found
    if (adElements.length > 0) {
      console.log('Sending ad elements:', adElements);
      chrome.runtime.sendMessage({ adElements }, (response) => {
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
  // INITIALIZATION
  // ============================================================================
  
  /**
   * Initialize ad detection system
   */
  function initializeAdDetection() {
    console.log('Initializing ad detection...');
    
    // Wait 5 seconds to ensure all ads are loaded
    setTimeout(() => {
      console.log('Starting ad scan...');
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