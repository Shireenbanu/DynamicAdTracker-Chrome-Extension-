// content.js - Improved Precision Ad Detector
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
     
  // Unambiguous ad selectors
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
     
  // Check ID/class patterns
  const id = element.getAttribute('id') || '';
  const className = element.getAttribute('class') || '';
     
  return AD_SIGNATURES.definitiveSelectors.some(selector => {
    try {
      return element.matches(selector);
    } catch (e) {
      return false;
    }
  });
}

function highlightAd(element) {
  if (element._adHighlighted) return;
  element._adHighlighted = true;
     
  // Store original styles to avoid conflicts
  const originalPosition = element.style.position;
  const originalZIndex = element.style.zIndex;
  
  // Create overlay without disrupting DOM structure
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
  
  // Add overlay to element
  element.appendChild(overlay);
  
  // Store reference for cleanup
  element._adOverlay = overlay;
}

function scanForAds() {
  // Use more specific selectors to reduce false positives
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

  candidates.forEach(element => {
    if (isDefinitiveAd(element)) {
      // Small delay to allow ad to start loading
      setTimeout(() => highlightAd(element), 100);
    }
  });
}

function handleDynamicAds() {
  // Watch for Google AdSense specifically
  if (window.adsbygoogle) {
    const originalPush = window.adsbygoogle.push;
    window.adsbygoogle.push = function(...args) {
      const result = originalPush.apply(this, args);
      // Scan for new ads after AdSense processes
      setTimeout(scanForAds, 500);
      return result;
    };
  }
  
  // Watch for GPT (Google Publisher Tag) ads
  if (window.googletag && window.googletag.cmd) {
    window.googletag.cmd.push(() => {
      window.googletag.pubads().addEventListener('slotRenderEnded', () => {
        setTimeout(scanForAds, 100);
      });
    });
  }
}

// Initial scan with delays to catch lazy-loaded ads
function performInitialScan() {
  scanForAds(); // Immediate scan
  setTimeout(scanForAds, 1000); // 1 second delay
  setTimeout(scanForAds, 3000); // 3 second delay
  setTimeout(scanForAds, 5000); // 5 second delay
}

// Enhanced MutationObserver
const observer = new MutationObserver(mutations => {
  let shouldScan = false;
  
  mutations.forEach(mutation => {
    // Check for added nodes
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) { // Element node
        // Check if the node itself is an ad
        if (isDefinitiveAd(node)) {
          setTimeout(() => highlightAd(node), 100);
        }
        
        // Check for ad-related attributes or content
        if (node.querySelector && (
          node.querySelector('iframe[src*="ads"]') ||
          node.querySelector('ins.adsbygoogle') ||
          node.querySelector('div[data-ad-unit]') ||
          node.classList.contains('adsbygoogle') ||
          node.id.includes('google_ads')
        )) {
          shouldScan = true;
        }
      }
    });
    
    // Check for attribute changes that might indicate ad loading
    if (mutation.type === 'attributes' && 
        (mutation.attributeName === 'src' || 
         mutation.attributeName === 'data-ad-status' ||
         mutation.attributeName.startsWith('data-ad'))) {
      shouldScan = true;
    }
  });
  
  if (shouldScan) {
    setTimeout(scanForAds, 200);
  }
});

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    performInitialScan();
    handleDynamicAds();
  });
} else {
  performInitialScan();
  handleDynamicAds();
}

// Start observing after initial setup
setTimeout(() => {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'data-ad-status', 'data-ad-unit', 'data-ad-client', 'data-ad-slot']
  });
}, 1000);

// Cleanup function
window.addEventListener('beforeunload', () => {
  observer.disconnect();
});