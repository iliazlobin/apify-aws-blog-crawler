import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';
// this is ESM project, and as such, it requires you to specify extensions in your relative imports
// read more about this here: https://nodejs.org/docs/latest-v18.x/api/esm.html#mandatory-file-extensions
// note that we need to use `.js` even when inside TS files
import { router } from './routes.js';

await Actor.init();

// const startUrls = [
//     'https://aws.amazon.com/blogs/architecture/',
//     'https://aws.amazon.com/blogs/mt/',
//     'https://aws.amazon.com/blogs/aws/',
//     'https://aws.amazon.com/blogs/apn/',
//     'https://aws.amazon.com/blogs/big-data/',
//     'https://aws.amazon.com/blogs/enterprise-strategy/',
//     'https://aws.amazon.com/blogs/aws-cloud-financial-management/',
//     'https://aws.amazon.com/blogs/compute/',
// ];

const startUrls = [
    'https://aws.amazon.com/blogs',
];

const proxyConfiguration = await Actor.createProxyConfiguration();

const {
    maxRequestsPerMinute = 5,
    maxRequestRetries = 10,
    requestHandlerTimeoutSecs = 1800,
} = await Actor.getInput<{
    maxRequestsPerMinute?: number,
    maxRequestRetries?: number,
    requestHandlerTimeoutSecs?: number
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

await crawler.run(startUrls);

await Actor.exit();
