let adTiles = [];

document.addEventListener('DOMContentLoaded', function() {
  const scanBtn = document.getElementById('scanBtn');
  const highlightBtn = document.getElementById('highlightBtn');
  const screenshotBtn = document.getElementById('screenshotBtn');
  const status = document.getElementById('status');
  const adList = document.getElementById('adList');

  scanBtn.addEventListener('click', scanForAdTiles);
  highlightBtn.addEventListener('click', toggleHighlight);
  screenshotBtn.addEventListener('click', screenshotAllAds);

  async function scanForAdTiles() {
    try {
      scanBtn.disabled = true;
      scanBtn.textContent = 'Scanning...';
      showStatus('Scanning page for ad tiles...', 'info');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'findAdTiles' });
      
      adTiles = response.adTiles || [];
      
      if (adTiles.length > 0) {
        highlightBtn.disabled = false;
        screenshotBtn.disabled = false;
        screenshotBtn.textContent = `Screenshot ${adTiles.length} Ad Tiles`;
        showStatus(`Found ${adTiles.length} ad tiles!`, 'success');
        displayAdList();
      } else {
        showStatus('No ad tiles found on this page.', 'warning');
        adList.style.display = 'none';
      }
    } catch (error) {
      console.error('Scan error:', error);
      showStatus('Error scanning page. Please refresh and try again.', 'warning');
    } finally {
      scanBtn.disabled = false;
      scanBtn.textContent = 'Scan for Ad Tiles';
    }
  }

  async function toggleHighlight() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleHighlight' });
      
      if (highlightBtn.textContent === 'Highlight Ad Tiles') {
        highlightBtn.textContent = 'Remove Highlights';
      } else {
        highlightBtn.textContent = 'Highlight Ad Tiles';
      }
    } catch (error) {
      showStatus('Error toggling highlights.', 'warning');
  }
  }

  async function screenshotAllAds() {
    if (adTiles.length === 0) return;

    try {
      screenshotBtn.disabled = true;
      screenshotBtn.textContent = 'Taking Screenshots...';
      showStatus('Capturing ad tile screenshots...', 'info');

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      let captured = 0;
      for (let i = 0; i < adTiles.length; i++) {
        const tile = adTiles[i];
        try {
          // Send message to content script to prepare the tile for screenshot
          await chrome.tabs.sendMessage(tab.id, { 
            action: 'prepareScreenshot', 
            tileIndex: i 
          });
    
          // Small delay to ensure scroll/highlight is complete
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Take screenshot of visible area
          const dataUrl = await chrome.tabs.captureVisibleTab();
    
          // Get the cropped image from content script
          const response = await chrome.tabs.sendMessage(tab.id, { 
            action: 'cropScreenshot', 
            dataUrl: dataUrl,
            tileIndex: i 
          });
          
          if (response.croppedDataUrl) {
            // Convert data URL to blob and download
            const blob = dataURLToBlob(response.croppedDataUrl);
            const url = URL.createObjectURL(blob);
            
            await chrome.downloads.download({
              url: url,
              filename: `ad_tile_${Date.now()}_${i + 1}.png`
            });
            
            // Clean up the blob URL
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            captured++;
          }
        } catch (error) {
          console.error('Failed to screenshot tile:', i, error);
        }
      }

      showStatus(`Successfully captured ${captured} of ${adTiles.length} ad tiles!`, 'success');
    } catch (error) {
      showStatus('Error capturing screenshots: ' + error.message, 'warning');
    } finally {
      screenshotBtn.disabled = false;
      screenshotBtn.textContent = `Screenshot ${adTiles.length} Ad Tiles`;
    }
  }

  function displayAdList() {
    adList.innerHTML = '';
    adTiles.forEach((tile, index) => {
      const item = document.createElement('div');
      item.className = 'ad-item';
      item.innerHTML = `
        <div class="ad-info">
          <div>${tile.type}</div>
          <div class="ad-size">${tile.width}x${tile.height}px</div>
        </div>
      `;
      adList.appendChild(item);
    });
    adList.style.display = 'block';
  }

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
  }

  function dataURLToBlob(dataURL) {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
    }
  });