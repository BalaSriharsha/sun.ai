const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/login');
  await page.type('input[placeholder="Email"]', 'demo@sunnyai.com');
  await page.type('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForNavigation();
  
  await page.goto('http://localhost:3000/playground');
  await page.waitForSelector('.chat-main');
  
  // Click Agent mode
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === 'Agent') {
      await btn.click();
      break;
    }
  }
  
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'playground_agent_mode.png' });
  console.log('Current URL (should have ?mode=agent):', page.url());
  
  // Click API Snippet
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.trim() === ' API') {
      await btn.click();
      break;
    }
  }
  
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'playground_api_snippet.png' });
  
  await browser.close();
})();
