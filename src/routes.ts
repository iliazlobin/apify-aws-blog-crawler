import Apify, { Actor } from 'apify';
import { createPuppeteerRouter } from 'crawlee';

export const router = createPuppeteerRouter();

router.addDefaultHandler(async ({ page, log, enqueueLinks }) => {
    const url = page.url() ?? '';
    log.info(`processing default page: ${url}`);

    let {
        lookBackWindow = 0,
        paginationLimit = 3,
    } = await Actor.getInput<{
        lookBackWindow?: number,
        paginationLimit?: number
    }>() || {};
    log.debug(`inputs: lookBackWindow=${lookBackWindow}, paginationLimit=${paginationLimit}`);

    for (let i = 0; i < paginationLimit; i++) {

        const cards = await page.$$eval('li[class="m-card m-list-card"]', () => '');
        log.debug(`Number of cards detected: ${cards.length}`);

        try {
            await page.waitForSelector('span.m-directories-more-arrow-icon');
            await page.click('span.m-directories-more-arrow-icon');
        } catch (e) {
            log.error(`error clicking on the "more" button: ${e}`);
            break;
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    log.info(`parsing all cards`);
    const cards = await page.$$eval('li[class="m-card m-list-card"]', (els) => {
        const items: any[] = [];

        for (const el of els) {
            const title = el.querySelector('div.m-card-title')?.textContent ?? '';
            const url = el.querySelector('a')?.getAttribute('href') ?? '';
            const info = el.querySelector('div.m-card-info')?.textContent ?? '';
            const entries = info.split(',').map((s) => s.trim());
            const date = entries[entries.length - 1];
            const authors = entries.slice(0, entries.length - 1);
            const desc = el.querySelector('div.m-card-description')?.textContent ?? '';

            items.push({
                title,
                url,
                authors,
                date,
                desc
            });
        }

        return items;
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfTodayText = startOfToday.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const targetDate = new Date(startOfToday.getTime() - lookBackWindow * 24 * 60 * 60 * 1000);
    const targetDateText = targetDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

    log.info(`filtering cards: ${targetDateText} - ${startOfTodayText}`);

    const filteredCards: any[] = [];
    for (const card of cards) {
        const date = new Date(card.date);
        const dateText = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        if (date < targetDate) {
            log.debug(`skipping card: (${dateText} < ${targetDateText}): ${card.url} ${card.title}`);
            continue;
        }
        if (!filteredCards.some(c => c.url === card.url)) {
            log.debug(`adding card (${dateText} > ${targetDateText}): ${card.url} ${card.title}`);
            filteredCards.push(card);
        }
    }

    log.info(`enqueuing ${filteredCards.length} cards`);
    for (const card of filteredCards) {
        log.debug(`enqueueing url: ${card.url} ${card.title}`);

        await enqueueLinks({
            urls: [card.url],
            label: 'article',
            userData: {
                title: card.title,
                authors: card.authors,
                date: card.date,
                desc: card.desc,
                targetDateText: targetDateText,
            },
        });
    }
});

router.addHandler('article', async ({ request, page, log }) => {
    const url = request.loadedUrl ?? '';
    const pageTitle = await page.title();
    const data = request.userData;

    const dateTag = await page.$eval('time[property="datePublished"]', (el) => el.textContent) ?? '';
    const date = new Date(dateTag);
    const dateText = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

    log.debug(`parsing page (${dateText}): ${url} ${pageTitle}`);

    const targetDateText = data.targetDateText;
    const targetDate = new Date(targetDateText)

    if (date < targetDate) {
        log.debug(`skipping article: (${dateText} < ${targetDateText}): ${url} ${pageTitle}`);
        return;
    }

    const links = await page.$eval('span.blog-post-categories', (el) => {
        const links: string[] = [];
        el.querySelectorAll('a').forEach((a) => {
            links.push(a.getAttribute('href') ?? '');
        });
        return links;
    });

    const categories: any[] = [];
    const tags: any[] = [];
    for (const link of links) {
        const regex = /category\/([^\/]*)\/?([^\/]*)?\/?/;
        const match = link.match(regex);
        const category = match ? match[1] : '';
        const tag = match ? match[2] ? match[2] : '' : '';
        if (category) categories.push(category);
        if (tag) tags.push(tag);
    }

    log.debug(`found ${categories.length} categories and ${tags.length} tags`);

    const text = await page.$eval('section[class="blog-post-content lb-rtxt"]', (el) => el.textContent);

    const regex = /blogs\/([^\/]*)/;
    const match = url.match(regex);
    const blog = match ? match[1] : '';

    log.info(`saving page (${dateText}): ${url} ${pageTitle}`);

    await Apify.Dataset.pushData({
        title: pageTitle,
        url: request.loadedUrl,
        authors: data.authors,
        date: data.date,
        categories: categories,
        tags: tags,
        text: text,
        blog: blog,
    });
});
