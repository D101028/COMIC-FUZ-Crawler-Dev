// 在最外層放一個 log，確認 Service Worker 有被喚醒
console.log("Background Service Worker 已啟動");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background 收到訊息:", message);

  // 點擊模擬
  if (message.action === "simulateClick") {
    const { tabId, x, y } = message;
    const target = { tabId: tabId };

    chrome.debugger.attach(target, "1.3", async () => {
      if (chrome.runtime.lastError) {
        console.error("Attach 失敗:", chrome.runtime.lastError.message);
        sendResponse({ status: "error", message: chrome.runtime.lastError.message });
        return;
      }

      try {
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mouseMoved", x: x, y: y, button: "left", clickCount: 0
        });
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mousePressed", x: x, y: y, button: "left", clickCount: 1
        });
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
          type: "mouseReleased", x: x, y: y, button: "left", clickCount: 1
        });

        console.log(`成功模擬點擊座標: (${x}, ${y})`);
        sendResponse({ status: "success" });
      } catch (error) {
        console.error("CDP 指令失敗:", error);
        sendResponse({ status: "failed", error: error.message });
      } finally {
        chrome.debugger.detach(target);
      }
    });

    return true; // 🔴 關鍵：回傳 true 代表我們會非同步調用 sendResponse
  }

  // 截圖模擬
  if (message.action === "captureTab") {
    // captureVisibleTab 只能截取當前視窗的可見區域
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error("截圖失敗:", chrome.runtime.lastError.message);
        sendResponse({ status: "error", message: chrome.runtime.lastError.message });
      } else {
        console.log("截圖成功！");
        // 將截圖的 Base64 資料回傳給 popup.js
        sendResponse({ status: "success", dataUrl: dataUrl });
      }
    });
    return true; // 保持非同步通訊
  }
});