// Standalone regressions for chapter hide and verified newly added entries.
// run: node tools/check-ui-features.mjs
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Script,createContext} from 'node:vm';
import {updateNewEntries} from './lib/entry-changes.mjs';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const html=readFileSync(resolve(root,'index.html'),'utf8');
const check=(v,message)=>{if(!v)throw new Error('隐藏/新增检查失败：'+message)};
const xml=readFileSync(resolve(root,'favicon.svg'),'utf8');
check(xml.includes('viewBox="0 0 64 64"') && xml.includes('#356c60'),'新版书本图标缺失');
check(html.includes('src="favicon.svg"')&&html.includes('href="favicon.svg?v=2"') &&
  !html.includes('class="icon-btn nav-readme"'),'图标不同源或旧文件图标仍在顶栏');
for(const id of ['hidden-section-list','hidden-chapter-count','recent-updates','recent-list','recent-count'])
  check(html.includes('id="'+id+'"'),'缺少元素 '+id);
check(html.includes('data-hide-sec=')&&html.includes('class="hide-chapter"'),'缺少章节隐藏按钮');
check(html.includes("howtolivebetter:hidden-items:v1") &&
 html.includes("howtolivebetter:hidden-sections:v1") &&
 html.includes("howtolivebetter:personal:v1"),'旧隐藏或个性化数据键改变');
check(html.includes("HIDDEN_SECTIONS.has(String(e.sec))") &&
 html.includes("readHiddenSections();") && html.includes("saveHiddenSections()"),'整章隐藏未接到展示与存储');
const marker='\n<script>\n/* ---------- 调试面板';
new Script(html.slice(html.indexOf(marker)+9,html.lastIndexOf('</script>')),{filename:'site.js'});

const c={};
c['01-不要早死.md']='# 1\n'+Array.from({length:600},(_,i)=>'### '+(i+1)+'. Existing '+i).join('\n');
const n={...c,'02-其他.md':'# 2\n'+Array.from({length:10},(_,i)=>'### '+(i+1)+'. New '+i).join('\n')};
const now='2026-10-12T06:00:00.000Z';
const history={version:1,entries:[]};
const updated=updateNewEntries(c,n,history,now);
check(updated.discovered===10&&updated.entries.length===10,'新增加 10 条没有准确识别');
check(updated.entries.every(e=>e.sec==='2'&&e.key===JSON.stringify([e.sec,e.title])),'新增标识不是稳定章节与标题');
const same=updateNewEntries(n,n,{version:1,entries:updated.entries},'2026-10-13T06:00:00.000Z');
check(same.discovered===0&&same.entries.length===10,'重复同步造成重复新增');
const expired=updateNewEntries(n,n,{version:1,entries:updated.entries},'2026-11-15T06:00:00.000Z');
check(expired.entries.length===0,'30 天后未清除旧新增记录');

const saved=new Map(), el={hidden:false,replaceChildren(){},setAttribute(){}};
const doc={getElementById:()=>el,querySelectorAll:()=>[],createElement:()=>({...el,className:'',dataset:{},append(){}}),
  createDocumentFragment:()=>({...el,appendChild(){}})};
const begin=html.indexOf("const HIDDEN_STORAGE_KEY = ");
const end=html.indexOf('/* ---------- 我的阅读 v1',begin);
check(begin>=0&&end>begin,'找不到隐藏逻辑');
const injected='\n({HIDDEN,HIDDEN_SECTIONS,readHidden,readHiddenSections,saveHidden,saveHiddenSections})';
const ctx=createContext({localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},
  document:doc,SECS:new Map(),CARDS:[],console});
const helper=new Script(html.slice(begin,end)+injected).runInContext(ctx);
helper.HIDDEN.add('["1","one item"]');helper.saveHidden();
helper.HIDDEN_SECTIONS.add('12');helper.saveHiddenSections();
check(JSON.parse(saved.get('howtolivebetter:hidden-items:v1')).length===1,'旧条目没保存');
check(JSON.parse(saved.get('howtolivebetter:hidden-sections:v1'))[0]==='12','隐藏章节没保存');
helper.HIDDEN.clear();helper.HIDDEN_SECTIONS.clear();helper.readHidden();helper.readHiddenSections();
check(helper.HIDDEN.size===1&&helper.HIDDEN_SECTIONS.has('12'),'两类隐藏无法独立恢复');
const dataset=JSON.parse(readFileSync(resolve(root,'data/new-entries.json'),'utf8'));
check(dataset.version===1&&Array.isArray(dataset.entries),'缺少站点追踪数据');
console.log('章节隐藏与新增历史检查通过：独立持久化、默认不隐藏、30 天记录、站点图标与脚本有效');
