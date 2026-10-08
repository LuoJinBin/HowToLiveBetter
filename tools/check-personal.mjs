// Opt-in reading regression tests, no additional dependencies.
import {readFileSync} from 'node:fs';
import {Script,createContext} from 'node:vm';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const html=readFileSync(resolve(root,'index.html'),'utf8');
const start=html.indexOf('const PERSON_STORAGE_KEY =');
const end=html.indexOf('// 侧栏条目目录：',start);
const assert=(condition,message)=>{if(!condition)throw new Error('个性化检查失败：'+message);};
assert(start>=0&&end>start,'个人规则代码缺失');
const sections=new Map([['1',{title:'不要早死'}],['17',{title:'家里有老人'}],
 ['20',{title:'刚出生的孩子怎么带：从出生到独立'}],['27',{title:'怀孕和生产：从发现怀孕到出院办证'}],['31',{title:'十八岁之后有哪几条路'}],
 ['40',{title:'新加入的章节'}]]);
const store=new Map();
const savedHidden=new Set(['["1","早已隐藏"]']);
const fakeDocument={getElementById:()=>({textContent:'',hidden:false})};
const context=createContext({SECS:sections,CARDS:[],HIDDEN:savedHidden,document:fakeDocument,
 localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},console});
const expression='\n({freshPersonal,validPersonal,personalMatches,loadPersonal,persistPersonal,'+
 'setProfile(value){PERSON=validPersonal(value)||freshPersonal()},getProfile(){return PERSON},'+
 'key:PERSON_STORAGE_KEY})';
const helpers=new Script(html.slice(start,end)+expression,{filename:'personal.logic.js'}).runInContext(context);
const sample=(sec,title)=>({e:{sec:String(sec),title},hiddenKey:JSON.stringify([String(sec),title])});
const pregnant=sample(27,'准备怀孕就开始每天补 0.4 毫克叶酸');
const screen=sample(1,'女性 40 岁起做乳腺癌筛查，每两年一次钼靶');
const maleCare=sample(1,'勃起功能出了问题，先去查心血管，别当成单纯的「那方面的事」');
const military=sample(31,'十八岁那年 10 月 31 日前要做兵役登记；义务兵服现役就是两年');
const oldAdult=sample(1,'65 岁以上打肺炎球菌疫苗');
const children=sample(20,'出生后 24 小时内打上乙肝疫苗第一针');
const elder=sample(17,'家里老人长期卧床');
const newEntry=sample(40,'刚更新的新条目');
const unknown=sample(1,'普通人都可以看的建议');
helpers.loadPersonal();
assert(!helpers.getProfile().configured&&helpers.getProfile().mode==='all','无设置时自动开启个性化');
assert([pregnant,screen,maleCare,military,oldAdult,children,elder,newEntry].every(helpers.personalMatches),
 '默认状态不应过滤任何条目');
assert(!store.has(helpers.key),'首次浏览不应该写入个人配置');
function setup(p){helpers.setProfile({version:1,configured:true,mode:'my',sex:'',age:'',roles:[],topics:[],
 skipKids:false,skipElders:false,overrides:{},...p});assert(helpers.getProfile().configured,'用户配置被拒绝');}
setup({sex:'male'});
assert(!helpers.personalMatches(pregnant)&&!helpers.personalMatches(screen),'男性偏好未筛除明确女性专属内容');
assert(helpers.personalMatches(maleCare)&&helpers.personalMatches(unknown),'男性偏好误筛通用内容');
helpers.getProfile().mode='all';
assert(helpers.personalMatches(pregnant)&&helpers.personalMatches(screen),'切回全部内容后有条目未恢复');
setup({sex:'male',roles:['parent']});
assert(helpers.personalMatches(pregnant),'家人照护例外未保留怀孕内容');
setup({sex:'female'});
assert(!helpers.personalMatches(maleCare)&&!helpers.personalMatches(military),'女性偏好未筛除明确男性专属内容');
setup({age:'18-24'});
assert(!helpers.personalMatches(oldAdult),'明确年龄未到的筛查未暂时收起');
assert(helpers.personalMatches(children)&&helpers.personalMatches(newEntry),'年龄设置过度过滤');
setup({age:'50+'});
assert(helpers.personalMatches(oldAdult),'50 岁及以上混合年龄段不应假设用户未满 65 岁');
setup({skipKids:true,skipElders:true});
assert(!helpers.personalMatches(children)&&!helpers.personalMatches(elder),'主动略过专题无效');
assert(helpers.personalMatches(newEntry)&&helpers.personalMatches(unknown),'缺失标签的建议应该默认显示');
setup({skipKids:true,overrides:{[children.hiddenKey]:'keep',[unknown.hiddenKey]:'skip'}});
assert(helpers.personalMatches(children),'总是显示不能覆盖自动筛选');
assert(!helpers.personalMatches(unknown),'暂时略过没有生效');
helpers.persistPersonal();
helpers.setProfile({});helpers.loadPersonal();
assert(helpers.getProfile().overrides[children.hiddenKey]==='keep','个性化设置不能跨刷新保存');
assert(savedHidden.size===1&&savedHidden.has('["1","早已隐藏"]'),'个人设置影响了手动隐藏记录');
console.log('个人模式检查通过：默认不变、年龄/性别保守判断、主动专题过滤、手动覆盖、全量切换、保存恢复、未知内容与隐藏隔离');
