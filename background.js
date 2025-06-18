// background.js - Fixed to match content.js message format

// ============================================================================
// MESSAGE LISTENER - Handle messages from content.js
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);
    
    // Check if message contains adElements array (from content.js)
    if (request.adElements && Array.isArray(request.adElements)) {
      console.log(`Processing ${request.adElements.length} ad elements:`, request.adElements);
      
      // Take screenshot for each ad element
      enqueueScreenshot(request.adElements, sender.tab.id, (dataUrl, coords) => {
        console.log("Screenshot taken with coordinates:", coords);


        sendResponse({ 
          status: "captured", 
          image: dataUrl, 
          coords: coords,
          count: request.adElements.length 
        });
      });
  
      // Required to keep `sendResponse` async
      return true;
    } else {
      console.log('No adElements found in message');
      sendResponse({ status: "no_ads", message: "No ad elements received" });
    }
  });
  
  // ============================================================================
  // SCREENSHOT QUEUE SYSTEM
  // ============================================================================
  
  const screenshotQueue = [];
  let isProcessing = false;
  
  /**
   * Process screenshot queue one by one
   */
  function processQueue() {
    if (isProcessing || screenshotQueue.length === 0) return;
  
    isProcessing = true;
    const { adElements, tabId, callback } = screenshotQueue.shift();
  
    console.log(`Taking screenshot for tab ${tabId} with ${adElements.length} ads`);
  
    // Capture screenshot of the visible tab
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error("Screenshot error:", chrome.runtime.lastError.message);
        callback(null, adElements);
      } else {
        console.log("Screenshot captured successfully");
        callback(dataUrl, adElements);
      }
  
      // Wait 1 second before processing next screenshot
      setTimeout(() => {
        isProcessing = false;
        processQueue();
      }, 1000);
    });
  }
  
  /**
   * Add screenshot request to queue
   * @param {Array} adElements - Array of ad coordinate objects
   * @param {number} tabId - Tab ID where ads were found
   * @param {Function} callback - Callback function to handle result
   */
  function enqueueScreenshot(adElements, tabId, callback) {
    screenshotQueue.push({ adElements, tabId, callback });
    console.log(`Added to queue. Queue length: ${screenshotQueue.length}`);
    processQueue();
  }
  
  // ============================================================================
  // UTILITY FUNCTIONS (Optional)
  // ============================================================================
  
  /**
   * Log ad coordinates in a readable format
   * @param {Array} adElements - Array of ad coordinate objects
   */
  function logAdCoordinates(adElements) {
    console.log('\n📍 Ad Coordinates Summary:');
    adElements.forEach((ad, index) => {
      console.log(`Ad ${index + 1}: 
        Position: (${ad.left}, ${ad.top})
        Size: ${ad.width}x${ad.height}px
        DPR: ${ad.dpr || 1}`);
    });
  }