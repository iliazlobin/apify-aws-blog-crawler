import { createPuppeteerRouter } from 'crawlee';

export const router = createPuppeteerRouter();

interface CardData {
    url: string;
    title: string;
    authors: string;
    datePublished: string;
    tags: string;
}

interface CardInfo {
    url: string;
    title: string;
    authors: string;
    date: Date;
    category: string;
    tags: string;
}

router.addDefaultHandler(async ({ enqueueLinks, page, log }) => {
    const url = page.url();
    const match = url.match(/blogs\/(.*)\//);
    const category = match ? match[1] : '';

    const allCards: CardData[] = await page.$$eval('article.blog-post', async (elements) => {
        const cards: CardData[] = [];

        for (const el of elements) {
            const url = el.querySelector('a[property="url"]')?.getAttribute('href') ?? '';
            const title = el.querySelector('span[property="name headline"]')?.textContent ?? '';
            const authors = Array.from(el.querySelectorAll('span[property="name"]')).map((author) => author.textContent).join(', ');
            const datePublished = el.querySelector('time[property="datePublished"]')?.getAttribute('datetime') ?? '';
            const tags = Array.from(el.querySelectorAll('span[property="articleSection"]')).map((category) => category.textContent).join(', ');

            cards.push({
                url,
                title,
                authors,
                datePublished,
                tags,
            });
        }

        return cards;
    });

    for (const { url, title, authors, datePublished, tags } of allCards) {
        log.info(`enqueueing url: ${url}`);

        const date = new Date(datePublished);

        await enqueueLinks({
            urls: [url],
            label: 'architecture-blog',
            userData: {
                title,
                authors,
                date,
                category,
                tags,
            },
        });
    }
});

import Apify from 'apify';

router.addHandler('architecture-blog', async ({ request, page, log }) => {
    const title = await page.title();
    const data = request.userData as CardInfo;
    const text = await page.$eval('section[class="blog-post-content lb-rtxt"]', (article) => article.textContent);
    log.info(`saving page: title: ${title}, url: ${request.loadedUrl}`);

    await Apify.Dataset.pushData({
        title: title,
        url: request.loadedUrl,
        authors: data.authors,
        date: data.date,
        category: data.category,
        tags: data.tags,
        text: text,
    });
});
