import { chromium } from 'playwright';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8776'], { cwd: process.cwd(), stdio: 'ignore' });
const URL = 'http://localhost:8776/demo/slides.html';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const countThumbs = async (sel) => {
  // count cards whose frame has a real .csma-thumb-scale child with a .slide inside
  return await (await srv).page?.$$eval ? 0 : 0;
};
try {
  await wait(1800);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await wait(900);

  const realCards = async (containerSel) => page.$$eval(`${containerSel} .slide-thumb-card`, (cards) =>
    cards.map((c) => ({
      idx: c.dataset.index,
      active: c.dataset.active,
      hasFrame: !!c.querySelector('.slide-thumb-frame'),
      hasScaleWrapper: !!c.querySelector('.csma-thumb-scale'),
      hasSlide: !!c.querySelector('.slide-thumb-frame .csma-thumb-scale .slide'),
    }))
  );

  // GRID
  await page.click('button[data-intent="INTENT_SLIDE_TOGGLE_GRID"]');
  await wait(600);
  const gridCards = await realCards('.slide-grid');
  log('GRID cards:', gridCards.length, '| with real slide:', gridCards.filter(c=>c.hasSlide).length, '| active:', gridCards.find(c=>c.active==='true')?.idx);
  await page.keyboard.press('Escape'); await wait(300);

  // RAIL
  await page.click('button[data-intent="INTENT_SLIDE_TOGGLE_RAIL"]');
  await wait(500);
  const railCards = await realCards('.slide-rail');
  log('RAIL cards:', railCards.length, '| with real slide:', railCards.filter(c=>c.hasSlide).length, '| active:', railCards.find(c=>c.active==='true')?.idx);
  // rail used to be text-only — confirm no rail-thumb text spans remain
  const railTextOnly = await page.$$('.slide-rail .rail-thumb');
  log('RAIL legacy text spans (should be 0):', railTextOnly.length);
  await page.click('button[data-intent="INTENT_SLIDE_TOGGLE_RAIL"]'); await wait(300);

  // DRAWER RAIL
  await page.click('button[data-intent="INTENT_COMMENTS_OPEN_DRAWER"]');
  await wait(700);
  const drawerCards = await realCards('.csma-comments-scoperail');
  log('DRAWER rail cards:', drawerCards.length, '| with real slide:', drawerCards.filter(c=>c.hasSlide).length, '| active:', drawerCards.find(c=>c.active==='true')?.dataset || '?');
  // active scope
  const activeScope = await page.getAttribute('.csma-comments-scoperail .slide-thumb-card[data-active="true"]', 'data-scope');
  log('DRAWER active scope:', activeScope);
  // click slide-3 card -> drawer switches scope
  const c3 = await page.$('.csma-comments-scoperail .slide-thumb-card[data-scope="deck:slide-3"]');
  if (c3) { await c3.click(); await wait(400); const na = await page.getAttribute('.csma-comments-scoperail .slide-thumb-card[data-active="true"]', 'data-scope'); log('DRAWER after click slide-3, active:', na); }
  await page.click('.csma-overlay-drawer .csma-overlay-close'); await wait(300);

  // DRAWING still per-slide (regression)
  await page.click('button[data-intent="INTENT_SLIDE_TOGGLE_DRAWING"]'); await wait(200);
  const box = await page.boundingBox('.slide-stage'); const x0=box.x+200, y0=box.y+200;
  await page.mouse.move(x0,y0); await page.mouse.down();
  for(let i=1;i<=6;i++) await page.mouse.move(x0+i*15, y0+i*5);
  await page.mouse.up(); await wait(300);
  const p = () => page.$$eval('svg.slide-annotator path.slide-annotation', e=>e.length);
  log('draw slide0:', await p());
  await page.keyboard.press('ArrowRight'); await wait(400);
  log('slide1 (should be 0):', await p());
  await page.keyboard.press('ArrowLeft'); await wait(400);
  log('back slide0 (should be 1):', await p());

  log('--- errors:', errs.length, JSON.stringify(errs.slice(0,5)));
  await browser.close();
} catch(e){ console.log('FATAL', e.message); }
finally { srv.kill('SIGTERM'); }
