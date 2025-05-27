// content.js - Precision Ad Detector
const AD_SIGNATURES = {
    // Direct ad platform identifiers
    adServerPatterns: [
      /ads?\.(doubleclick|google|facebook|amazon)\./i,
      /(googleads|doubleclick)\.g\.doubleclick\.net/i,
      /pagead2\.googlesyndication\.com/i,
      /adservice\.google\./i
    ],
  
    // Unambiguous ad selectors
    definitiveSelectors: [
      'iframe[src*="ads"]',
      'div[data-ad-unit]',
      'div[data-ad-client]',
      'div[data-ad-slot]',
      'div[data-testid="ad"]',
      'div[aria-label="Ad"]',
      'ins.adsbygoogle',
      'div[id^="google_ads_iframe"]',
      'div[id^="div-gpt-ad"]',
      'div[class*="AdContainer"]'
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
    
    const highlight = document.createElement('div');
    highlight.style.position = 'absolute';
    highlight.style.top = '0';
    highlight.style.left = '0';
    highlight.style.right = '0';
    highlight.style.border = '2px solid red';
    highlight.style.zIndex = '9999';
    highlight.style.pointerEvents = 'none';
    highlight.style.boxSizing = 'border-box';
    
    const label = document.createElement('div');
    label.textContent = 'Advertisement';
    label.style.position = 'absolute';
    label.style.top = '0';
    label.style.right = '0';
    label.style.background = 'red';
    label.style.color = 'white';
    label.style.padding = '2px 4px';
    label.style.fontSize = '10px';
    label.style.fontFamily = 'Arial, sans-serif';
    
    highlight.appendChild(label);
    
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.display = 'inline-block';
    
    element.parentNode.insertBefore(container, element);
    container.appendChild(element);
    container.appendChild(highlight);
  }
  
  function scanForAds() {
    // Check all potential ad containers
    const candidates = document.querySelectorAll(
      'iframe, div, ins, span, section, aside'
    );
  
    candidates.forEach(element => {
      if (isDefinitiveAd(element)) {
        highlightAd(element);
      }
    });
  }
  
  // Initial scan
  scanForAds();
  
  // Monitor for new ads
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) { // Element node
          if (isDefinitiveAd(node)) {
            highlightAd(node);
          }
          node.querySelectorAll('iframe, div, ins').forEach(child => {
            if (isDefinitiveAd(child)) {
              highlightAd(child);
            }
          });
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });