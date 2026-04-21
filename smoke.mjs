// Headless smoke test: opens the app, captures console errors and network failures.
import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://127.0.0.1:5180';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

const consoleMsgs = [];
const pageErrors = [];
const failedRequests = [];

page.on('console', msg => {
  const t = msg.type();
  if (t === 'error' || t === 'warning') {
    consoleMsgs.push({ type: t, text: msg.text() });
  }
});
page.on('pageerror', err => pageErrors.push(err.message));
page.on('requestfailed', req =>
  failedRequests.push({ url: req.url(), reason: req.failure()?.errorText }),
);

try {
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
} catch (e) {
  console.log('NAVIGATION ERROR:', e.message);
}

// Wait extra to allow async data fetches
await new Promise(r => setTimeout(r, 4000));

const html = await page.content();
const rootHtml = await page.$eval('#root', el => el.innerHTML);
const rootText = await page.evaluate(() => document.getElementById('root')?.innerText || '');

console.log('=== ROOT EMPTY?', rootHtml.length === 0, '| length=', rootHtml.length);
console.log('=== TITLE:', await page.title());
console.log('=== ROOT TEXT preview (first 300 chars):');
console.log(rootText.slice(0, 300));
console.log();
console.log('=== PAGE ERRORS:', pageErrors.length);
pageErrors.forEach(e => console.log('  -', e));
console.log();
console.log('=== CONSOLE ERRORS/WARNINGS:', consoleMsgs.length);
consoleMsgs.slice(0, 15).forEach(m => console.log(`  [${m.type}]`, m.text.slice(0, 300)));
console.log();
console.log('=== FAILED REQUESTS:', failedRequests.length);
failedRequests.slice(0, 10).forEach(r => console.log('  -', r.url, '|', r.reason));

await browser.close();
process.exit(0);
