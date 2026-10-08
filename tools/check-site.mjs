// Lightweight fail-closed smoke checks for upstream sync and independently maintained website.
// Run after syncing book/ + docs/ and before committing updated data.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFileSync(resolve(root, path), 'utf8');
const assert = (ok, why) => { if (!ok) throw new Error('内容与站点检查失败：' + why); };
const readme = read('README.md'), html = read('index.html');
const files = readdirSync(resolve(root,'book')).filter(f => /^\d\d-.+\.md$/.test(f)).sort();
const linked = [...new Set([...readme.matchAll(/\]\((book\/[^)#]+\.md)\)/g)].map(m => m[1].slice(5)))].sort();
assert(files.length >= 33 && JSON.stringify(files) === JSON.stringify(linked), 'README 章节清单与 book/ 不一致');

const entries = files.reduce((n, file) =>
  n + (read('book/' + file).match(/^### \d+\. /gm) || []).length, 0);
assert(entries >= 600, '正文章节或条目异常缺失');
const headingCount = Number((readme.match(/\n(\d+) 条建议/) || [])[1]);
assert(headingCount === entries, 'README 页首条目数与正文不一致');
const statBlocks = [...readme.matchAll(/全书 (\d+) 条中/g)].map(m => Number(m[1]));
assert(statBlocks.length === 2 && statBlocks.every(n => n === entries), 'README 证据/性价比统计未同步');
const badgeCount = Number((readme.match(/%E6%9D%A1%E7%9B%AE-(\d+)%20%E6%9D%A1/) || [])[1]);
assert(badgeCount === entries, 'README 条目徽章数字未同步');
assert(html.includes('id="f-sec"') && html.includes('id="q"') &&
  html.includes('id="hidden-nav"') && html.includes('howtolivebetter:hidden-items:v1'),
  '独立站搜索、筛选或隐藏功能缺失');
assert(!/googletagmanager|google-analytics|G-NTPGXCLMP6/.test(html), '不应继续携带原作者统计代码');
assert(!/mcyyy|## 广告位/.test(readme + html), '不应重新引入上游广告');
assert(/CC BY 4\.0/.test(readme + html) && /eternity4719\/HowToLiveBetter/.test(readme + html),
  '原作者来源或新许可未正确标注');
assert(read('robots.txt').includes('luojinbin.github.io/HowToLiveBetter/sitemap.xml') &&
  read('sitemap.xml').includes('luojinbin.github.io/HowToLiveBetter/'),
  '站点地图指向了其他网站');
const marker = '\n<script>\n/* ---------- 调试面板';
const start = html.indexOf(marker), end = html.lastIndexOf('</script>');
assert(start !== -1 && end > start, '找不到页面主脚本');
new Script(html.slice(start + '\n<script>'.length, end), { filename:'index.inline.js' });
assert(html.includes('<!-- ga:start') && html.includes('<!-- ga:end -->'),
  '离线构建用的兼容标记缺失');
console.log('站点数据检查通过：' + files.length + ' 节，' + entries + ' 条；UI、隐私、许可和主脚本结构正常');
