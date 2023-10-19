const value = "https://aws.amazon.com/blogs/modernizing-with-aws/category/aws-on-windows";
const regex = /category\/([^\/]*)\/?([^\/]*)?\/?/;
const match = value.match(regex);
const category = match ? match[1] : '';
const tag = match ? match[2] ? match[2] : '' : '';
console.log(`category: ${category}`);
console.log(`tag: ${tag}`);
