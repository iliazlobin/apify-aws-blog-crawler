import Apify, { Actor } from 'apify';
import { createPuppeteerRouter } from 'crawlee';

export const router = createPuppeteerRouter();

router.addDefaultHandler(async ({ page, log, enqueueLinks }) => {

    let { lookBackWindow = 1,
        cardsLimit = 100,
        paginationLimit = 10,
    } = await Actor.getInput<{
        lookBackWindow?: number,
        cardsLimit?: number,
        paginationLimit?: number
    }>() || {};
    log.debug(`Inputs:
        lookBackWindow: ${lookBackWindow}
        cardsLimit: ${cardsLimit}
        paginationLimit: ${paginationLimit}
    `);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const targetDate = new Date(startOfToday.getTime() - lookBackWindow * 24 * 60 * 60 * 1000);

    log.info(`targetDate: ${targetDate}, startOfToday: ${startOfToday}`);

    let stop = false;

    const allCards: any[] = [];

    for (let i = 0; i < paginationLimit; i++) {
        await new Promise(r => setTimeout(r, 500));
        try {
            await page.waitForSelector('span.m-directories-more-arrow-icon');
            await page.click('span.m-directories-more-arrow-icon');
        } catch (e) {
            log.error(`error clicking on the "more" button: ${e}`);
            stop = true;
            break;
        }

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

        for (const card of cards) {
            const date = new Date(card.date);
            if (date < targetDate) {
                log.debug(`skipping card: [${date}] (${card.url}) ${card.title}`);
                // log.info(`the target date has been reached: ${targetDate}`);
                // stop = true;
                continue;
            }
            if (cardsLimit > 0 && allCards.length >= cardsLimit) {
                log.debug(`the cards limit has been reached: ${cardsLimit}`);
                stop = true;
                break;
            }
            if (!allCards.some(c => c.url === card.url)) {
                log.debug(`adding card (${allCards.length}): [${date}] (${card.url}) ${card.title}`);
                allCards.push(card);
            }
        }

        if (stop) {
            break;
        }
        if (allCards.length >= cardsLimit) {
            break;
        }
    }

    log.debug(`collected ${allCards.length} cards`);

    for (const card of allCards) {
        log.info(`enqueueing url: ${card.url}`);

        await enqueueLinks({
            urls: [card.url],
            label: 'article',
            userData: {
                title: card.title,
                authors: card.authors,
                date: card.date,
                desc: card.desc
            },
        });
    }
});

router.addHandler('article', async ({ request, page, log }) => {
    const title = await page.title();
    const data = request.userData;

    const datePublishedText = await page.$eval('time[property="datePublished"]', (el) => el.textContent) ?? '';
    const date = new Date(datePublishedText);
    log.debug(`datePublished: ${date}`);

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

    log.info(`saving page: title: ${title}, url: ${request.loadedUrl}`);

    const url = request.loadedUrl ?? '';
    const regex = /blogs\/([^\/]*)/;
    const match = url.match(regex);
    const blog = match ? match[1] : '';

    await Apify.Dataset.pushData({
        title: title,
        url: request.loadedUrl,
        authors: data.authors,
        date: data.date,
        categories: categories,
        tags: tags,
        text: text,
        blog: blog,
    });
});
