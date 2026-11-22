import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

export async function verifyTradeNavigation(browser, base) {
  for (const scenario of ['cached', 'in-flight', 'canonical-response']) {
    const page = await browser.newPage({
      viewport: scenario === 'cached' ? {width: 1440, height: 900} : {width: 390, height: 844},
    });
    try {
      const hash = '0x' + '1'.repeat(64);
      const market = {
        id: 'pudge-xudt', identity: hash, genesis: hash,
        token: {name: 'Roveko Genesis', symbol: 'RVK'},
        pair: 'RVK / CKB', supply: '2000', inventory: '1988', custody: '12',
        custodyRoot: hash, reserveShannons: '18600000000',
        buyOneShannons: '2200000000', sellOneShannons: '2100000000',
        curve: {base: '1000000000', step: '100000000', sold: '12', supply: '2000'},
        tip: {number: '100', hash}, refreshedAt: Date.now(),
        history: [], historyState: 'verified', manifest: {},
      };
      let canonicalRequests = 0;
      await page.route('**/api/**', route => route.abort());
      let release;
      const heldDisplay = new Promise(resolve => {release = resolve;});
      await page.route('**/api/markets?display=1', async route => {
        if (scenario !== 'cached') await heldDisplay;
        if (scenario === 'canonical-response') return route.fulfill({json: market});
        await route.fulfill({
          headers: {'X-Roveko-State': 'display-snapshot'},
          json: {...market, historyState: 'unavailable'},
        });
      });
      await page.route('**/api/markets', async route => {
        assert.equal(route.request().method(), 'GET');
        canonicalRequests++;
        await route.fulfill({json: market});
      });
      const display = page.waitForRequest('**/api/markets?display=1');
      await page.goto(base);
      await display;
      if (scenario === 'cached') await page.getByText('Roveko Genesis', {exact: true}).waitFor();
      await page.getByRole('navigation').getByRole('link', {name: 'Trade', exact: true}).click();
      await page.waitForURL('**/market/pudge-xudt');
      if (scenario !== 'cached') {
        await page.getByRole('heading', {name: 'Bonding curve'}).waitFor();
        assert.equal(canonicalRequests, 0);
        release();
      }
      await page.getByText('Verified', {exact: true}).waitFor({timeout: 8_000});
      assert.equal(canonicalRequests, scenario === 'canonical-response' ? 0 : 1);
      await page.getByRole('button', {name: 'Connect Wallet'}).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(await page.getByRole('link', {name: /Classic Trade|Trade preview|Trade V2/}).count(), 0);
      console.log('PASS Markets to Trade', scenario);
    } finally {
      await page.close();
    }
  }
}

if (process.argv[2]) {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH});
  try {await verifyTradeNavigation(browser, process.argv[2]);}
  finally {await browser.close();}
}
