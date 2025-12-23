import puppeteer from 'puppeteer';

(async () => {
  console.log('Testing multiplayer connection...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Open two pages (host and guest)
  const hostPage = await browser.newPage();
  const guestPage = await browser.newPage();

  // Track logs from both pages
  hostPage.on('console', msg => console.log('[HOST]', msg.text()));
  guestPage.on('console', msg => console.log('[GUEST]', msg.text()));

  try {
    // Both navigate to the site
    console.log('Opening host page...');
    await hostPage.goto('https://lexidice.vercel.app/', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Opening guest page...');
    await guestPage.goto('https://lexidice.vercel.app/', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Host: Click "HOST DUEL"
    console.log('\n[HOST] Clicking HOST DUEL...');
    await hostPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const hostButton = buttons.find(b => b.textContent.includes('HOST DUEL'));
      if (hostButton) hostButton.click();
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get host's peer ID
    const hostId = await hostPage.evaluate(() => {
      const idElement = document.querySelector('[class*="text-3xl"][class*="tracking"]');
      return idElement ? idElement.textContent.trim() : null;
    });

    console.log(`\n[HOST] Peer ID: ${hostId}`);

    if (!hostId || hostId === 'ROLLING...') {
      console.error('Failed to get host peer ID!');
      await browser.close();
      return;
    }

    // Guest: Click "JOIN DUEL"
    console.log('\n[GUEST] Clicking JOIN DUEL...');
    await guestPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const joinButton = buttons.find(b => b.textContent.includes('JOIN DUEL'));
      if (joinButton) joinButton.click();
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Guest: Enter host ID and connect
    console.log(`[GUEST] Entering host ID: ${hostId}`);
    await guestPage.evaluate((id) => {
      const input = document.querySelector('input[placeholder*="KEY"]');
      if (input) {
        input.value = id;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, hostId);

    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('[GUEST] Clicking connect button...');
    await guestPage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const connectButton = buttons.find(b => b.querySelector('svg')); // Checkmark button
      if (connectButton) connectButton.click();
    });

    // Wait and check connection status
    await new Promise(resolve => setTimeout(resolve, 5000));

    const hostConnected = await hostPage.evaluate(() => {
      const statusText = document.body.textContent;
      return statusText.includes('NETWORK STABLE') || statusText.includes('Connection established');
    });

    const guestConnected = await guestPage.evaluate(() => {
      const statusText = document.body.textContent;
      return statusText.includes('NETWORK STABLE') || statusText.includes('Connection established');
    });

    console.log('\n=== RESULTS ===');
    console.log(`Host connected: ${hostConnected}`);
    console.log(`Guest connected: ${guestConnected}`);

    if (hostConnected && guestConnected) {
      console.log('✅ CONNECTION SUCCESSFUL!');
    } else {
      console.log('❌ CONNECTION FAILED');
    }

    await new Promise(resolve => setTimeout(resolve, 5000));

  } catch (error) {
    console.error('Error during test:', error);
  }

  await browser.close();
})();
