const puppeteer = require('puppeteer');
const path = require('path');

describe('Teta-Brick Baby E2E Tests', () => {
    let browser;
    let page;

    beforeAll(async () => {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
        });
    });

    afterAll(async () => {
        if (browser) await browser.close();
    });

    beforeEach(async () => {
        page = await browser.newPage();
        
        page.on('dialog', async dialog => {
            console.log('Dialog caught:', dialog.message());
            await dialog.accept();
        });

        await page.goto('http://127.0.0.1:8080/index.html');
        await page.waitForSelector('.app-container');

        await page.evaluate(() => {
            localStorage.clear();
        });
        await page.goto('http://127.0.0.1:8080/index.html');
        await page.waitForSelector('.app-container');
    });

    afterEach(async () => {
        await page.close();
    });

    test('Should load main interface', async () => {
        const title = await page.title();
        expect(title).toBe('Teta-Brick Baby');
    });

    test('Should register left breast from timer', async () => {
        await page.click('#btn-left');
        await new Promise(r => setTimeout(r, 10500)); // wait >10s
        await page.click('#btn-left'); // pause
        
        await page.click('#btn-registrar');
        await new Promise(r => setTimeout(r, 500));
        
        await page.click('.nav-item[data-target="view-historial"]');
        await page.waitForSelector('.daily-group', {timeout: 5000});
        
        const historyHtml = await page.$eval('#history-container', el => el.innerHTML);
        expect(historyHtml).toContain('Izquierdo');
    });

    test('Should register right breast from timer', async () => {
        await page.click('#btn-right');
        await new Promise(r => setTimeout(r, 10500)); // wait >10s
        await page.click('#btn-right'); // pause
        
        await page.click('#btn-registrar');
        await new Promise(r => setTimeout(r, 500));
        
        await page.click('.nav-item[data-target="view-historial"]');
        await page.waitForSelector('.daily-group', {timeout: 5000});
        const historyHtml = await page.$eval('#history-container', el => el.innerHTML);
        expect(historyHtml).toContain('Derecho');
    });

    test('Should register bottle', async () => {
        await page.click('.nav-item[data-target="view-biberon"]');
        
        // Start bottle timer
        await page.click('#btn-bottle');
        await new Promise(r => setTimeout(r, 500));
        
        // Open ML modal
        await page.click('#btn-bottle');
        await page.waitForSelector('#ml-modal.active', {timeout: 5000});
        
        // Enter ML
        await page.type('#modal-ml-input', '150');
        await page.click('#ml-save');
        await new Promise(r => setTimeout(r, 500));
        
        await page.click('#btn-registrar');
        await new Promise(r => setTimeout(r, 500));
        
        await page.click('.nav-item[data-target="view-historial"]');
        await page.waitForSelector('.daily-group', {timeout: 5000});
        const historyHtml = await page.$eval('#history-container', el => el.innerHTML);
        expect(historyHtml).toContain('150 mL');
    });

    test('Should register diaper', async () => {
        await page.evaluate(() => document.getElementById('btn-diaper').click());
        await new Promise(r => setTimeout(r, 500));
        await page.evaluate(() => document.getElementById('btn-registrar').click());
        await new Promise(r => setTimeout(r, 500));
        
        await page.click('.nav-item[data-target="view-historial"]');
        await page.waitForSelector('.daily-group', {timeout: 5000});
        const historyHtml = await page.$eval('#history-container', el => el.innerHTML);
        expect(historyHtml).toContain('💩');
    });

    test('Should manually create event and show in history', async () => {
        await page.click('.nav-item[data-target="view-historial"]');
        await page.waitForSelector('.daily-group', {timeout: 5000}).catch(() => {}); 
        
        await page.click('#btn-add-event');
        await page.waitForSelector('#edit-modal.active', {timeout: 5000});
        
        await page.select('#event-type', 'bottle');
        await page.type('#edit-duration', '120'); // 120ml
        await page.click('#edit-save');
        
        await new Promise(r => setTimeout(r, 500));
        const historyHtml = await page.$eval('#history-container', el => el.innerHTML);
        expect(historyHtml).toContain('120 mL');
    });

    test('Should delete event from history', async () => {
        await page.evaluate(() => document.getElementById('btn-diaper').click());
        await new Promise(r => setTimeout(r, 500));
        await page.evaluate(() => document.getElementById('btn-registrar').click());
        await new Promise(r => setTimeout(r, 500));
        
        await page.click('.nav-item[data-target="view-historial"]');
        await page.waitForSelector('.delete-btn', {timeout: 5000});
        
        await page.click('.delete-btn');
        await page.waitForSelector('#delete-modal.active', {timeout: 5000});
        
        await page.click('#delete-confirm');
        await new Promise(r => setTimeout(r, 500));
        
        const historyHtml = await page.$eval('#history-container', el => el.innerHTML);
        expect(historyHtml).not.toContain('💩');
    });

    // test('Should merge manual events if close in time', async () => {
    //    Commented out until it's implemented.
    // });
});
