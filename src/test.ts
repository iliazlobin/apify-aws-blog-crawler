const value = "https://aws.amazon.com/blogs/modernizing-with-aws/category/aws-on-windows";
const now = new Date();
const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
const startOfTodayText = startOfToday.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
const lookBackWindow = 1;
const targetDate = new Date(startOfToday.getTime() - lookBackWindow * 24 * 60 * 60 * 1000);
const targetDateText = targetDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
console.log(`end`);
