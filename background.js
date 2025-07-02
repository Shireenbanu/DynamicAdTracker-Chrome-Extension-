// background.js - AUTO-PROCESS Ad Screenshots from Content.js Coordinates
// ============================================================================
// MAIN SCREENSHOT WORKFLOW - AUTO-PROCESSING ONLY
// ============================================================================
chrome.action.onClicked.addListener(async (tab) => {
    console.log('Extension icon clicked - Auto-processing is enabled, so screenshots are taken automatically when ads are detected.');
    console.log('No manual action needed.');
  });
  
  // ============================================================================
  // CORE FUNCTIONS
  // ============================================================================
  
  /**
   * Process ad screenshots using the actual coordinates from content.js
   */
  async function processAdScreenshots(adElements, tab) {
    console.log('Starting ad screenshot process with coordinates:', adElements);
    
    const results = [];
    const pageInfo = await getPageInfo(tab);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    for (let i = 0; i < adElements.length; i++) {
      const adElement = adElements[i];
      console.log(`📸 Processing ad ${i + 1}/${adElements.length}`);
      console.log(`Ad dimensions: ${adElement.width}x${adElement.height} at (${adElement.left}, ${adElement.top})`);
      
      try {
        // Calculate scroll position to center the ad
        // Using the actual 'top' coordinate from your content script
        const adCenterY = adElement.top + (adElement.height / 2);
        const viewportHeight = 600; // fallback viewport height
        const targetScrollY = Math.max(0, adCenterY - (viewportHeight / 2));
        
        console.log(`Scrolling to position: ${targetScrollY} (ad center: ${adCenterY})`);
        
        // Scroll to bring ad into view
        await scrollToPosition(tab.id, targetScrollY);
        
        // Wait for scroll to complete and page to stabilize
        await sleep(800);
        
        // Take screenshot of current viewport
        const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: 'png',
          quality: 90
        });
        
        // Calculate where the ad should be in the screenshot
        const adInScreenshot = {
          x: adElement.left,
          y: Math.max(0, adElement.top - targetScrollY), // Adjust for scroll position
          width: adElement.width,
          height: adElement.height,
          centerX: adElement.left + (adElement.width / 2),
          centerY: Math.max(0, adElement.top - targetScrollY) + (adElement.height / 2)
        };
        
        // Store result
        const result = {
          adIndex: i,
          originalAd: {
            width: adElement.width,
            height: adElement.height,
            absoluteX: adElement.left,
            absoluteY: adElement.top,
            dpr: adElement.dpr || 1,
            tagName: 'AD_ELEMENT',
            id: `ad_${i}`,
            className: `ad-${adElement.width}x${adElement.height}`
          },
          screenshot: screenshot,
          coordinatesInScreenshot: adInScreenshot,
          scrollPosition: targetScrollY,
          timestamp: Date.now(),
          success: true
        };
        
        results.push(result);
        console.log(`✅ Successfully captured ad ${i + 1}`);
        
      } catch (error) {
        console.error(`❌ Failed to capture ad ${i + 1}:`, error);
        results.push({
          adIndex: i,
          originalAd: adElement,
          error: error.message,
          success: false
        });
      }
      
      // Small delay between screenshots
      await sleep(300);
    }
    
    // Process results and trigger downloads
    await processAndDownloadScreenshots(results, tab, pageInfo, timestamp);
    
    // Reset page to original state
    await resetPageState(tab.id);
    
    console.log('✅ Screenshot process completed successfully!');
  }
  
  /**
   * Process screenshots and trigger downloads
   */
  async function processAndDownloadScreenshots(screenshots, tab, pageInfo, timestamp) {
    const successful = screenshots.filter(s => s.success);
    const failed = screenshots.filter(s => !s.success);
    
    console.log(`\n📊 SCREENSHOT RESULTS:`);
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📈 Success rate: ${((successful.length / screenshots.length) * 100).toFixed(1)}%`);
    
    if (successful.length === 0) {
      console.log('No successful screenshots to download');
      return;
    }
    
    // Download each screenshot
    for (let i = 0; i < successful.length; i++) {
      const result = successful[i];
      await downloadScreenshot(result, pageInfo, timestamp, i + 1);
      await sleep(100); // Small delay between downloads
    }
    
    // Create and download summary, uncomment this if you ever want to download the ad summary
    // await downloadSummary(successful, pageInfo, timestamp);
    
    console.log(`🎉 Downloaded ${successful.length} ad screenshots!`);
  }
  
  /**
   * Download individual screenshot - FIXED to use Chrome Downloads API
   */
  async function downloadScreenshot(result, pageInfo, timestamp, sequenceNumber) {
    try {
      const adInfo = result.originalAd;
      const adSize = `${adInfo.width}x${adInfo.height}`;
      const filename = `ad_screenshots/${pageInfo.domain}/ad_${sequenceNumber}_${adSize}_${Date.now()}.png`;
      // Use the screenshot data URL directly with Chrome Downloads API
      await chrome.downloads.download({
        url: result.screenshot, // Data URL can be used directly
        filename: filename,
        saveAs: false
        // conflictAction: 'uniquify' // Optional: automatically rename if file exists
      });
      
      console.log(`📥 Downloaded: ad_${sequenceNumber}_${adSize}_${timestamp}.png`);
      
    } catch (error) {
      console.error('Failed to download screenshot:', error);
      // Fallback: try without folder structure
      try {
        const fallbackFilename = `ad_${sequenceNumber}_${adInfo.width}x${adInfo.height}_${timestamp}.png`;
        await chrome.downloads.download({
          url: result.screenshot,
          filename: fallbackFilename,
          saveAs: false
        });
        console.log(`📥 Downloaded (fallback): ${fallbackFilename}`);
      } catch (fallbackError) {
        console.error('Fallback download also failed:', fallbackError);
      }
    }
  }
  
  /**
   * Download summary JSON file - FIXED to use Chrome Downloads API
   */
  async function downloadSummary(screenshots, pageInfo, timestamp) {
    try {
      const summary = {
        captureInfo: {
          timestamp: timestamp,
          url: pageInfo.url,
          domain: pageInfo.domain,
          title: pageInfo.title,
          totalAds: screenshots.length,
          captureMethod: 'content_script_coordinates'
        },
        ads: screenshots.map((result, index) => ({
          sequence: index + 1,
          adInfo: {
            dimensions: {
              width: result.originalAd.width,
              height: result.originalAd.height
            },
            originalPosition: {
              left: result.originalAd.absoluteX,
              top: result.originalAd.absoluteY
            },
            devicePixelRatio: result.originalAd.dpr
          },
          screenshotInfo: {
            coordinatesInScreenshot: result.coordinatesInScreenshot,
            scrollPosition: result.scrollPosition,
            captureTimestamp: result.timestamp
          }
        }))
      };
      
      // Convert JSON to data URL
      const jsonString = JSON.stringify(summary, null, 2);
      const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);
      
      const summaryFilename = `ad_screenshots/${pageInfo.domain}/summary_${timestamp}.json`;
      
      await chrome.downloads.download({
        url: dataUrl,
        filename: summaryFilename,
        saveAs: false
      });
      
      console.log('📥 Downloaded summary file');
      
    } catch (error) {
      console.error('Failed to download summary:', error);
      // Fallback: try without folder structure
      try {
        const jsonString = JSON.stringify(summary, null, 2);
        const dataUrl = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);
        const fallbackFilename = `summary_${timestamp}.json`;
        
        await chrome.downloads.download({
          url: dataUrl,
          filename: fallbackFilename,
          saveAs: false
        });
        console.log('📥 Downloaded summary file (fallback)');
      } catch (fallbackError) {
        console.error('Fallback summary download also failed:', fallbackError);
      }
    }
  }
  
  // Removed getAdsFromPage function - only process ads from content script
  
  /**
   * Get page information for organizing downloads
   */
  async function getPageInfo(tab) {
    try {
      const url = new URL(tab.url);
      return {
        url: tab.url,
        domain: url.hostname.replace('www.', ''),
        title: tab.title || 'untitled',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        url: tab.url || 'unknown',
        domain: 'unknown',
        title: tab.title || 'untitled',
        timestamp: Date.now()
      };
    }
  }
  
  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  
  /**
   * Scroll to a specific position on the page
   */
  async function scrollToPosition(tabId, yPosition) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: (y) => {
          window.scrollTo({ top: y, behavior: 'instant' });
        },
        args: [yPosition]
      });
    } catch (error) {
      console.error('Failed to scroll:', error);
    }
  }
  
  /**
   * Reset page to original state
   */
  async function resetPageState(tabId) {
    try {
      await scrollToPosition(tabId, 0);
      console.log('Page reset to top');
    } catch (error) {
      console.log('Could not reset page state:', error);
    }
  }
  
  /**
   * Sleep utility function
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Removed fallback ad detection - only process coordinates from content script
  
  // ============================================================================
  // MESSAGE LISTENERS - AUTO-PROCESS SCREENSHOTS
  // ============================================================================
  
  /**
   * Handle messages from content script - AUTO-PROCESS SCREENSHOTS
   */
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    if (request.adElements && Array.isArray(request.adElements)) {
      console.log(`✅ Received ${request.adElements.length} ad coordinates from content script`);
      console.log('🚀 Auto-processing screenshots...');
      
      // Log the coordinates for debugging
      request.adElements.forEach((ad, index) => {
        console.log(`Ad ${index + 1}: ${ad.width}x${ad.height} at (${ad.left}, ${ad.top})`);
      });
      
      try {
        await processAdScreenshots(request.adElements, sender.tab);
        sendResponse({ 
          status: 'processed', 
          count: request.adElements.length,
          message: 'Screenshots captured and downloaded!'
        });
      } catch (error) {
        console.error('Auto-processing failed:', error);
        sendResponse({ 
          status: 'error', 
          message: error.message 
        });
      }
      
      return true;
    }
    
    // Handle other message types if needed
    return true;
  });