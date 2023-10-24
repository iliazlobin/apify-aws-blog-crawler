import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';
import { router } from './routes.js';

await Actor.init();

const proxyConfiguration = await Actor.createProxyConfiguration();

const defaultUrls = [
    'https://aws.amazon.com/blogs',
];

const {
    maxRequestsPerMinute = 5,
    maxRequestRetries = 5,
    requestHandlerTimeoutSecs = 600,
    urls = defaultUrls,
} = await Actor.getInput<{
    maxRequestsPerMinute?: number,
    maxRequestRetries?: number,
    requestHandlerTimeoutSecs?: number
    urls?: string[],
}>() || {};

const crawler = new PuppeteerCrawler({
    proxyConfiguration,
    requestHandler: router,
    maxRequestsPerMinute,
    maxRequestRetries,
    requestHandlerTimeoutSecs,
    // useSessionPool: false,
    retryOnBlocked: true,
    launchContext: {
        useChrome: true,
        launchOptions: {
            executablePath: '/root/apps/chromium/linux-1211267/chrome-linux/chrome',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
    },
});

await crawler.run(urls);

await Actor.exit();
