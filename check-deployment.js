import puppeteer from 'puppeteer';

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Collect console logs
  const logs = [];
  page.on('console', msg => {
    logs.push({
      type: msg.type(),
      text: msg.text()
    });
  });

  // Collect errors
  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.message);
  });

  page.on('requestfailed', request => {
    errors.push(`Failed to load: ${request.url()} - ${request.failure().errorText}`);
  });

  page.on('response', response => {
    if (response.status() === 404) {
      logs.push({
        type: '404',
        text: `404 Not Found: ${response.url()}`
      });
    }
  });

  console.log('Navigating to https://lexidice.vercel.app/...');

  try {
    await page.goto('https://lexidice.vercel.app/', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait a bit for React to render
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get page title
    const title = await page.title();
    console.log('\nPage Title:', title);

    // Get visible text content
    const bodyText = await page.evaluate(() => {
      return document.body.innerText;
    });
    console.log('\nVisible Text Content:');
    console.log(bodyText);

    // Check if root div has content
    const rootContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        hasChildren: root ? root.children.length > 0 : false,
        innerHTML: root ? root.innerHTML.substring(0, 500) : 'No root element found'
      };
    });
    console.log('\nRoot Element Status:');
    console.log('Has children:', rootContent.hasChildren);
    console.log('Content preview:', rootContent.innerHTML);

    // Take screenshot
    await page.screenshot({
      path: 'deployment-screenshot.png',
      fullPage: true
    });
    console.log('\nScreenshot saved to deployment-screenshot.png');

    // Print console logs
    console.log('\n=== CONSOLE LOGS ===');
    logs.forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });

    // Print errors
    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach(error => {
        console.log(error);
      });
    } else {
      console.log('\n=== NO ERRORS FOUND ===');
    }

  } catch (error) {
    console.error('Error during navigation:', error.message);
  }

  await browser.close();
  console.log('\nBrowser closed.');
})();
