// 本站独立维护新增记录。仅比较上游正文标题，不能以 GitHub commit 时间冒充原文发表时间。
// 不读取、不合并上游的界面代码；不会改动原作者的正文。
export function collectEntryKeys(directoryFiles){
  const map = new Map();
  for (const [filename, body] of Object.entries(directoryFiles)){
    const m = filename.match(/^(\d{2})-.+\.md$/);
    if (!m) continue;
    const sec = String(Number(m[1]));
    for (const row of body.split(/\r?\n/)){
      const titleMatch=row.match(/^###\s+\d+\.\s+(.+?)\s*$/);
      if (!titleMatch) continue;
      const title = titleMatch[1];
      const key = JSON.stringify([sec,title]);
      map.set(key,{key,sec,title});
    }
  }
  return map;
}
export function updateNewEntries(previousFiles,nextFiles,stored,clock=new Date()){
  if (!stored || stored.version!==1 || !Array.isArray(stored.entries)) throw new Error('新增记录格式错误');
  const before = collectEntryKeys(previousFiles), after = collectEntryKeys(nextFiles);
  if (before.size < 600 || after.size < 600) throw new Error('正文数量异常，暂停新增记录同步');
  const now=clock instanceof Date ? clock : new Date(clock);
  if(!Number.isFinite(now.getTime())) throw new Error('时间格式错误');
  const active=new Map();
  const cutoff=now.getTime()-30*24*3600*1000;
  for(const e of stored.entries){
    if(!e || typeof e.key!=='string'||typeof e.addedAt!=='string')continue;
    const time=Date.parse(e.addedAt);
    if(time>=cutoff && time<=now.getTime() && after.has(e.key))
      active.set(e.key,{...after.get(e.key),addedAt:e.addedAt});
  }
  const addedAt=now.toISOString();
  let discovered=0;
  const countBySection=keys=>{
    const totals=new Map();
    for(const item of keys.values())totals.set(item.sec,(totals.get(item.sec)||0)+1);
    return totals;
  };
  const oldCounts=countBySection(before),newCounts=countBySection(after);
  const candidates=new Map();
  for(const [key,item] of after){
    if(before.has(key)||active.has(key))continue;
    if(!candidates.has(item.sec))candidates.set(item.sec,[]);
    candidates.get(item.sec).push(item);
  }
  for(const [sec,items] of candidates){
    const actualGrowth=(newCounts.get(sec)||0)-(oldCounts.get(sec)||0);
    // 新标题数大于该章条目增长量时，可能是改名或替换；不猜哪条是真新增。
    if(actualGrowth<=0||items.length!==actualGrowth)continue;
    for(const item of items){active.set(item.key,{...item,addedAt});discovered++;}
  }
  const entries=[...active.values()]
    .sort((a,b)=>b.addedAt.localeCompare(a.addedAt) || a.sec.localeCompare(b.sec,'zh',{numeric:true}) || a.title.localeCompare(b.title,'zh'))
    .slice(0,150);
  return {version:1,entries,discovered};
}
