// 仅同步原项目的内容数据，不合并其代码、网站样式、广告或工作流。
// 使用：node tools/sync-upstream-content.mjs /path/to/upstream-clone
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = resolve(process.argv[2] || '');
const read = path => readFileSync(join(ROOT, path), 'utf8');
const upstream = path => readFileSync(join(SRC, path), 'utf8');
const need = (condition, why) => { if (!condition) throw new Error('同步已中止：' + why); };
need(process.argv[2] && existsSync(join(SRC, 'README.md')) && existsSync(join(SRC, 'book')), '没有找到上游源码目录');
need(SRC !== ROOT, '上游与目标目录不能相同');

const sourceReadme = upstream('README.md');
const license = upstream('LICENSE');
need(license.includes('Attribution 4.0 International'), '上游正文许可不再是 CC BY 4.0，请检查后调整');
const sourceBook = readdirSync(join(SRC, 'book')).filter(f => f.endsWith('.md')).sort();
need(sourceBook.length >= 33, '上游正文章节数异常');
need(sourceBook.every(f => /^\d{2}-.+\.md$/.test(f)), '上游存在不符合预期的章节文件名');
const linkedBook = [...new Set([...sourceReadme.matchAll(/\]\((book\/[^)]+\.md)\)/g)].map(m => m[1].slice(5)))].sort();
need(JSON.stringify(linkedBook) === JSON.stringify(sourceBook), '上游 README 目录和 book/ 文件清单不一致');
for (const f of sourceBook) {
  const text = upstream('book/' + f);
  need(/^# \d+\. /m.test(text) && /^### \d+\. /m.test(text), '章节格式不兼容：' + f);
}
need(existsSync(join(SRC, 'docs')), '上游 docs/ 目录不存在');

// 只替换本地 README 的数据片段，保留自己的介绍、网站链接和去广告修改。
function replaceSection(local, source, name) {
  const header = '## ' + name + '\n';
  function bounds(text) {
    const begin = text.indexOf(header);
    need(begin !== -1, 'README 缺少标题：' + name);
    const next = text.indexOf('\n## ', begin + header.length);
    need(next !== -1, 'README 片段没有结束边界：' + name);
    return [begin, next + 1];
  }
  const [a, b] = bounds(local), [c, d] = bounds(source);
  return local.slice(0, a) + source.slice(c, d) + local.slice(b);
}
let readme = read('README.md');
for (const heading of ['这本书想回答的问题', '读懂数字（术语表）', '目录'])
  readme = replaceSection(readme, sourceReadme, heading);

const sourceCount = sourceReadme.match(/(\d+)\s*条建议/);
need(sourceCount, '上游条目总数标识缺失');
need(/\d+\s*条建议/.test(readme), '本地条目总数标识缺失');
readme = readme.replace(/\d+\s*条建议/, sourceCount[0]);
for (const label of ['条目', '证据分级', '原始文献']) {
  const prefix = '[![' + label + '](';
  const line = text => text.split('\n').find(s => s.startsWith(prefix));
  const updated = line(sourceReadme), previous = line(readme);
  need(updated && previous, 'README 统计徽章缺失：' + label);
  readme = readme.replace(previous, updated);
}
const oldLicenseBadge = readme.split('\n').find(s => s.startsWith('[![许可]('));
need(oldLicenseBadge, 'README 缺少许可徽章');
const newLicenseBadge = '[![许可](https://img.shields.io/badge/%E6%AD%A3%E6%96%87-CC%20BY%204.0-565a5f?style=flat-square)](LICENSE-CONTENT)';
readme = readme.replace(oldLicenseBadge, newLicenseBadge);
need(/正文按节拆成 \d+ 个文件/.test(readme), 'README 章节数说明格式改变');
readme = readme.replace(/正文按节拆成 \d+ 个文件/, '正文按节拆成 ' + sourceBook.length + ' 个文件');

const credit = '\n## 内容来源与许可\n\n'
  + '本仓库的 book/ 与 docs/ 正文和资料自动同步自 [高性价比人生指南原项目](https://github.com/eternity4719/HowToLiveBetter)，作者 eternity4719。文字依照 [CC BY 4.0](LICENSE-CONTENT) 使用；保留出处和许可链接。本站的页面布局、筛选、隐藏等功能由本仓库单独维护，不与原项目代码同步。原项目更新时，本仓库同步内容可能存在短暂延迟。最新同步版本见 [UPSTREAM_SOURCE.md](UPSTREAM_SOURCE.md)。\n\n';
if (/^## 内容来源与许可$/m.test(readme)) {
  const start = readme.indexOf('## 内容来源与许可\n');
  const end = readme.indexOf('\n## ', start + 4);
  need(end !== -1, '现有来源声明没有结束边界');
  readme = readme.slice(0, start) + credit.trimStart() + readme.slice(end + 1);
} else {
  const position = readme.indexOf('## Star 走势\n');
  need(position !== -1, '找不到 README 来源声明插入点');
  readme = readme.slice(0, position) + credit + readme.slice(position);
}
need(!readme.includes('## 广告位') && !readme.includes('mcyyy'), '检查到广告内容意外进入 README');
const finalLinks = [...new Set([...readme.matchAll(/\]\((book\/[^)]+\.md)\)/g)].map(m => m[1].slice(5)))].sort();
need(JSON.stringify(finalLinks) === JSON.stringify(sourceBook), '生成后的 README 正文文件列表不完整');

// 所有源数据检查通过后才更新白名单文件；禁止修改网站 DIY。
rmSync(join(ROOT, 'book'), { recursive: true, force: true });
cpSync(join(SRC, 'book'), join(ROOT, 'book'), { recursive: true });
rmSync(join(ROOT, 'docs'), { recursive: true, force: true });
cpSync(join(SRC, 'docs'), join(ROOT, 'docs'), { recursive: true });
writeFileSync(join(ROOT, 'README.md'), readme);
writeFileSync(join(ROOT, 'LICENSE-CONTENT'), license);
const sha = execFileSync('git', ['-C', SRC, 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
need(/^[a-f0-9]{40}$/.test(sha), '无法读取上游 Git 提交编号');
const metadata = '# 正文同步来源\n\n'
  + '- 来源：[eternity4719/HowToLiveBetter](https://github.com/eternity4719/HowToLiveBetter)\n'
  + '- 上游提交：[' + sha + '](https://github.com/eternity4719/HowToLiveBetter/commit/' + sha + ')\n'
  + '- 最后同步检查：' + new Date().toISOString() + '\n'
  + '- 范围：book/、docs/、README.md 的章节目录、术语表、内容型表格和相关统计\n'
  + '- 未同步：index.html、tools/、.github/ 中原项目的代码与样式、广告及赞赏内容\n'
  + '- 正文许可：[CC BY 4.0](LICENSE-CONTENT)\n';
writeFileSync(join(ROOT, 'UPSTREAM_SOURCE.md'), metadata);
console.log('同步检查通过：' + sourceBook.length + ' 节；正文 ' + sourceCount[1] + ' 条；上游 ' + sha.slice(0, 12));
