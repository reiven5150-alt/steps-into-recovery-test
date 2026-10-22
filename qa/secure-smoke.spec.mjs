import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const problems=[];
 page.on('pageerror',e=>problems.push(e.message));
 await page.goto('http://127.0.0.1:4173/full-journey.html',{waitUntil:'domcontentloaded'});
 await page.getByText(/missing a code/i).waitFor();
 assert.equal(await page.locator('#game').count(),0);
 assert.equal(await page.locator('#access-status').getAttribute('data-build'),'11.1.0');
 await page.goto('http://127.0.0.1:4173/index.html',{waitUntil:'domcontentloaded'});
 await page.locator('#startBtn').click();
 await page.locator('#game.active').waitFor();
 assert.ok((await page.locator('.location').count())>=6);
 await page.goto('http://127.0.0.1:4173/plans.html',{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('a[href^="https://buy.stripe.com/"]').count(),10);
 assert.deepEqual(problems,[]);
 console.log('Public game and secure entry smoke checks passed');
} finally {await browser.close();}
