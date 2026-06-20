import { CONFIG } from './config.js';

const simulateClick = async (clickX, clickY) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    console.error("找不到活動中的分頁");
    return;
  }

  console.log("正在發送訊息給 Background...", tab.id);

  chrome.runtime.sendMessage({ 
    action: "simulateClick", 
    tabId: tab.id, 
    x: clickX, 
    y: clickY
  }, (response) => {
    console.log("收到 Background 的回應:", response);
  });
}

const captureTab = (saveName = null) => {
  console.log("正在請求網頁截圖...");

  chrome.runtime.sendMessage({ action: "captureTab" }, (response) => {
    if (response && response.status === "success") {
      const dataUrl = response.dataUrl;
      
      // 使用範例：自動下載這張截圖
      const a = document.createElement('a');
      a.href = dataUrl;
      if (!saveName) { saveName = `screenshot_${Date.now()}.png`; }
      a.download = saveName;
      a.click();
      
      console.log("截圖已下載");
    } else {
      console.error("無法取得截圖", response?.message);
    }
  });
}

// 抓取主網頁的內容
const getMainPageElement = async (selector) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    console.error("找不到活動中的分頁");
    return null;
  }

  // 注入腳本到主網頁中執行
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (targetSelector) => {
      // 🔴 這段程式碼會在「主網頁」的環境中執行
      const element = document.querySelector(targetSelector);
      
      if (!element) return null;

      // ⚠️ 注意：不能直接回傳整個 DOM 節點物件 (HTMLElement)，
      // 必須回傳純文字、數字、陣列或純 JSON 物件，否則會序列化失敗。
      return {
        textContent: element.textContent.trim(),
        innerHTML: element.innerHTML,
        className: element.className,
        id: element.id,
        href: element.href || null // 如果是超連結
      };
    },
    args: [selector] // 將 selector 作為參數傳進 func 中
  });

  // executeScript 會回傳一個陣列，對應到多個 frame，通常我們只需要第一個結果
  if (results && results[0]) {
    return results[0].result;
  }
  return null;
}
// click 主網頁抓取到的內容
const clickMainPageElement = async (selector) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (targetSelector) => {
      // 🔴 這段在網頁環境執行
      const element = document.querySelector(targetSelector);
      if (element) {
        element.click();
        return true;
      }
      return false;
    },
    args: [selector]
  });
}

let globalEsc = false;
document.getElementById("escBtn").addEventListener('click', () => {
    alert('使用者終止！');
    globalEsc = true; 
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const nextEpSelector = "#__next > div > div:nth-child(1) > div:nth-child(1) > div > div.InternalViewer_viewer__xBDA7.false.false.false > div > div > div > div:nth-child(2) > div > div > div > div.ChapterLastPage_lastpage__nextChapter__6t7yj > a";
const endMarkSelector = "#__next > div > div:nth-child(1) > div:nth-child(1) > div > div.InternalViewer_viewer__xBDA7.false.false.false > div > div > div > div:nth-child(2) > div:nth-child(2) > div > div > a > div";
const epTitleSelector = "#__next > div > div:nth-child(1) > div.title_detail_viewer__detail__GMG16 > div:nth-child(1) > h2";
const main = async () => {
  globalEsc = false;
  console.log("開始爬取");
  
  async function crawlSingleEp() {
    // 獲得標題
    const titleEle = await getMainPageElement(epTitleSelector);
    const epTitle = titleEle.innerHTML;
    if (!epTitle) { alert("Error: Could Not Get epTitle"); return titleEle; }

    // 全螢幕化
    await simulateClick(CONFIG.fullizePos.x, CONFIG.fullizePos.y);
    await sleep(2000);
    // 消除頂欄
    await simulateClick(CONFIG.normalPos.x, CONFIG.normalPos.y);
    await sleep(2000);
    // 換頁、截圖主迴圈
    let cnt = 1;
    while (true) {
      await sleep(1500);
      // 截圖
      const tail = `${cnt}`.padStart(3, "0");
      captureTab(`${epTitle}_${tail}.png`);

      // 結束與否
      if (globalEsc) return "esc";
      const nextEpBtn = await getMainPageElement(nextEpSelector);
      if (nextEpBtn) return "next";
      const endMarkBtn = await getMainPageElement(endMarkSelector);
      if (endMarkBtn) return "end";

      // 下一頁
      await simulateClick(CONFIG.nextPagePos.x, CONFIG.nextPagePos.y);

      cnt++;
    }
  }

  while (true) {
    // 爬取一整話
    const result = await crawlSingleEp();
    
    if (result === "end") return;
    else if (result === "next") {
      // 點擊下一話按鈕
      const status = await clickMainPageElement(nextEpSelector); 
      await sleep(5000);
    } else if (result === "esc") {
      return console.log("User Interuption");
    }
    else {
      throw Error("Error Occured: ", result); 
    }

  }
}

document.getElementById('mainBtn').addEventListener("click", main);


