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
      let displayRequests = 0;
      let failDisplay = false;
      const paths = [];
      page.on("request", request => {
        const url = new URL(request.url());
        if (url.pathname === "/api/markets") paths.push(url.pathname + url.search);
      });
      await page.route('**/api/**', route => route.abort());
      let release;
      const heldDisplay = new Promise(resolve => {release = resolve;});
      await page.route('**/api/markets?display=1', async route => {
        displayRequests++;
        if (failDisplay) return route.fulfill({status:503,json:{error:'Controlled outage'}});
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
      if (scenario === 'cached') {
        await page.getByText('Roveko Genesis', {exact: true}).waitFor();
        await page.getByText('Buy price', {exact:true}).first().waitFor();
        assert.equal(await page.getByText('CKB/RVK',{exact:true}).count(),2);
        await page.getByText('Market provenance',{exact:true}).click();
        await page.getByText(/Snapshot block/).waitFor();
        await page.getByText(/Market read/).waitFor();
        failDisplay = true;
        await page.getByRole('button',{name:'Refresh',exact:true}).click();
        await page.getByText('Refresh failed. Showing the previous market snapshot.').waitFor();
        assert.equal(displayRequests,2);
        assert.equal(canonicalRequests,0);
        await page.setViewportSize({width:390,height:844});
        await page.getByRole('button',{name:'切换到简体中文'}).click();
        await page.getByRole('heading',{name:'市场',exact:true}).waitFor();
        await page.getByText('刷新失败。正在显示之前的市场快照。').waitFor();
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.reload();
        await page.getByText('市场数量未知').waitFor();
        await page.getByRole('button',{name:'Switch to English'}).click();
        await page.getByText('Market count unavailable').waitFor();
        failDisplay = false;
        await page.getByRole('button',{name:'Retry',exact:true}).click();
        await page.getByText('Roveko Genesis',{exact:true}).waitFor();
      }
      await page.getByRole('navigation').getByRole('link', {name: 'Trade', exact: true}).click();
      await page.waitForURL('**/market/pudge-xudt');
      if (scenario !== 'cached') {
        await page.getByRole('heading', {name: 'Price chart'}).waitFor();
        assert.equal(canonicalRequests, 0);
        release();
      }
      await page.getByText('Verified', {exact: true}).waitFor({timeout: 8_000});
      assert.equal(canonicalRequests, scenario === 'canonical-response' ? 0 : 1);
      await page.locator('.brant-header').getByRole('button', {name: 'Connect Wallet'}).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(await page.getByRole('link', {name: /Classic Trade|Trade preview|Trade V2/}).count(), 0);
      console.log('PASS Markets to Trade', scenario, paths.join(' → '));
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
