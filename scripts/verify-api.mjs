import assert from 'node:assert/strict';
import fs from 'node:fs';
if(process.stdin.isTTY) process.stdin.setRawMode(true);
console.log('Ready for test credentials on stdin');
const line = await new Promise(resolve => {
  let buffer='';
  function read(chunk) {buffer+=chunk.toString(); if(/[\r\n]/.test(buffer)){process.stdin.off('data',read);resolve(buffer.trim());}}
  process.stdin.on('data',read);
});
if(process.stdin.isTTY) process.stdin.setRawMode(false);
process.stdin.pause();
const {password} = JSON.parse(line);
fs.mkdirSync('work',{recursive:true});
const base = 'http://127.0.0.1:5173';
function client() {
  const jar = new Map();
  return async (path, body, headers = {}) => {
    const response = await fetch(`${base}/api/${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),...headers},body:body===undefined?undefined:JSON.stringify(body)});
    for(const cookie of response.headers.getSetCookie()) { const [name,value] = cookie.split(';')[0].split('='); jar.set(name,value); }
    const text=await response.text();
    let data; try {data=JSON.parse(text);} catch {data={error:text};}
    return {status:response.status, data};
  };
}
const player=client(), admin=client(), stranger=client(), checks=[];
async function ok(label, action) { await action(); checks.push(label); console.log('PASS',label); }
async function expect(call,status=200) { const r=await call; assert.equal(r.status,status,r.data.error);return r.data; }
const boot=await expect(player('bootstrap'));
const box=boot.cases.find(c=>c.name==='LONESTAR');
let state=boot.player.state;
let originalSettings;
try {
await ok('Complete original catalog',async()=>{assert.equal(boot.cases.length,146);assert.equal(boot.skins.length,16527);for(const entries of Object.values(boot.caseContents)){assert(entries.length);assert(Math.abs(entries.reduce((n,x)=>n+x.chance,0)-100)<1e-7);}});
await ok('Admin and origin protection',async()=>{await expect(stranger('admin/bootstrap'),401);await expect(player('bonus',{}, {Origin:'https://foreign.test'}),403);await expect(admin('admin/login',{login:'admin',password}));});
originalSettings=(await expect(admin('admin/bootstrap'))).settings;
await ok('Registration preserves guest account',async()=>{const r=await expect(player('auth/register',{login:`qa_${Date.now()}`,password:'Verification-Local-Only-22',name:'Проверка API'}));assert.equal(r.player.id,boot.player.id);assert.equal(r.player.state.balance,state.balance);});
await ok('Avatar persists, serves a raster image and rejects unsafe uploads',async()=>{
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP9sAAAAASUVORK5CYII=';
  await expect(stranger('profile/avatar',{image}),401);
  await expect(player('profile/avatar',{image:'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='}),400);
  await expect(player('profile/avatar',{image:'data:image/png;base64,PHN2Zz48L3N2Zz4='}),400);
  const uploaded=await expect(player('profile/avatar',{image}));
  assert(uploaded.player.avatar.startsWith(`/api/avatar/${boot.player.id}?v=`));
  const saved=await expect(player('bootstrap'));
  assert.equal(saved.player.avatar,uploaded.player.avatar);
  const response=await fetch(base+uploaded.player.avatar);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Content-Type'),'image/png');
  assert((await response.arrayBuffer()).byteLength>8);
});
await ok('Balance controls and fractional amounts',async()=>{for(const [mode,amount,want] of [['set',5000,5000],['add',12.34,5012.34],['subtract',2.14,5010.2]]){const r=await expect(admin('admin/user',{id:boot.player.id,action:'balance',mode,amount,reason:'Локальная проверка'}));assert.equal(r.player.state.balance,want);state=r.player.state;}await expect(admin('admin/user',{id:boot.player.id,action:'balance',mode:'set',amount:-1,reason:'Проверка'}),400);});
let drops;
await ok('Open ten cases with exact debit and valid drops',async()=>{const before=state.balance;const r=await expect(player('open',{caseId:box.id,count:10}));drops=r.result.drops;state=r.player.state;assert.equal(drops.length,10);assert.equal(state.balance,Math.round((before-10*box.price)*100)/100);assert.equal(state.inventory.length,10);assert(drops.every(d=>boot.caseContents[box.id].some(x=>x.skinId===d.skin.id&&x.price===d.skin.price)));});
await ok('Duplicate and locked inventory protection',async()=>{await expect(player('sell',{ids:[drops[0].item.uid,drops[0].item.uid]}),400);await expect(player('lock',{uid:drops[0].item.uid}));await expect(player('sell',{ids:[drops[0].item.uid]}),400);await expect(player('lock',{uid:drops[0].item.uid}));});
await ok('Concurrent sale credits an item once',async()=>{const before=state.balance;const results=await Promise.all([player('sell',{ids:[drops[0].item.uid]}),player('sell',{ids:[drops[0].item.uid]})]);assert.equal(results.filter(r=>r.status===200).length,1);state=(await expect(player('bootstrap'))).player.state;assert.equal(state.balance,Math.round((before+drops[0].skin.price)*100)/100);assert.equal(state.inventory.length,9);});
await ok('Contract consumes three items and returns one in range',async()=>{const ids=drops.slice(1,4).map(d=>d.item.uid),total=drops.slice(1,4).reduce((n,d)=>n+d.skin.price,0);const r=await expect(player('contract',{ids}));state=r.player.state;assert.equal(state.inventory.length,7);assert(!state.inventory.some(i=>ids.includes(i.uid)));assert(r.result.skin.price>=total*originalSettings.contractMin&&r.result.skin.price<=total*originalSettings.contractMax);});
await ok('Upgrade settles server result and inventory atomically',async()=>{const item=state.inventory[0],target=boot.skins.find(s=>s.price>item.price*2);const before=state.inventory.length;const r=await expect(player('upgrade',{ids:[item.uid],target:target.id,extra:0}));state=r.player.state;assert.equal(r.result.won,r.result.roll<r.result.chance);assert.equal(state.inventory.length,before-1+Number(r.result.won));assert(!state.inventory.some(i=>i.uid===item.uid));});
await ok('Daily bonus cannot be claimed twice concurrently',async()=>{const before=state.balance;const responses=await Promise.all([player('bonus',{}),player('bonus',{})]);assert.equal(responses.filter(r=>r.status===200).length,1);state=(await expect(player('bootstrap'))).player.state;assert.equal(state.balance,Math.round((before+originalSettings.dailyBonus)*100)/100);});
await ok('Holding farm uses elapsed time and concurrent ticks do not double credit',async()=>{
  await expect(player('farm/tick',{}),400);
  const before=(await expect(player('bootstrap'))).player.state.balance;
  const started=await expect(player('farm/start',{}));
  await new Promise(resolve=>setTimeout(resolve,500));
  const results=await Promise.all([player('farm/tick',{}),player('farm/tick',{})]);
  assert(results.every(r=>r.status===200));
  const stopped=await expect(player('farm/tick',{stop:true}));
  const credited=stopped.player.state.balance-before;
  const elapsed=Date.now()-started.player.state.farmHoldAt;
  assert(credited>0&&credited<=elapsed*originalSettings.farmReward*.8/1000+.03);
  await expect(player('farm/tick',{}),400);
  state=stopped.player.state;
});
await ok('Farm cooldown and one-time promo',async()=>{await expect(player('farm',{}));await expect(player('farm',{}),400);await expect(player('promo',{code:'WELCOME'}));await expect(player('promo',{code:'WELCOME'}),400);});
await ok('Admin odds control drives actual drop',async()=>{const pool=boot.caseContents[box.id], winner=pool[0].skinId,weights=Object.fromEntries(pool.map(x=>[x.skinId,x.skinId===winner?100:0]));await expect(admin('admin/settings',{settings:{odds:{...originalSettings.odds,[box.id]:weights}}}));const r=await expect(player('open',{caseId:box.id,count:3}));assert(r.result.drops.every(d=>d.skin.id===winner));await expect(admin('admin/settings',{settings:originalSettings}));});
await ok('Ban prevents player mutations',async()=>{await expect(admin('admin/user',{id:boot.player.id,action:'ban',banned:true}));await expect(player('open',{caseId:box.id,count:1}),403);await expect(admin('admin/user',{id:boot.player.id,action:'ban',banned:false}));});
await ok('Duplicate case records apply each admin weight once',async()=>{const patchCase=boot.cases.find(c=>c.id==='patch'),pool=boot.caseContents[patchCase.id],weights=Object.fromEntries(pool.map(x=>[x.skinId,1]));await expect(admin('admin/settings',{settings:{odds:{...originalSettings.odds,[patchCase.id]:weights}}}));const actual=await expect(player(`catalog?case=${patchCase.id}`));assert(actual.every(x=>Math.abs(x.chance-100/pool.length)<1e-9));await expect(admin('admin/settings',{settings:originalSettings}));});
await ok('Support reply and audit records',async()=>{await expect(player('tickets',{subject:'Проверка поддержки',message:'Проверка локальной системы обращений'}));const ticket=(await expect(player('tickets')))[0];await expect(admin('admin/ticket',{id:ticket.id,reply:'Проверка выполнена',status:'closed'}));const updated=(await expect(player('tickets')))[0];assert.equal(updated.reply,'Проверка выполнена');assert.equal(updated.status,'closed');const a=await expect(admin('admin/bootstrap'));assert(a.logs.some(x=>x.action==='user.balance'));assert(a.logs.some(x=>x.action==='settings.update'));});
await ok('Logout invalidates the administrator session',async()=>{await expect(admin('admin/logout',{}));await expect(admin('admin/bootstrap'),401);});
fs.writeFileSync('work/api-verification.json',JSON.stringify({passed:true,checks,at:new Date().toISOString()},null,2));
console.log('Verified',checks.length,'integration scenarios');
} catch(error) {
  if(originalSettings) { await admin('admin/login',{login:'admin',password}); await admin('admin/settings',{settings:originalSettings}); }
  fs.writeFileSync('work/api-verification.json',JSON.stringify({passed:false,checks,error:error.message},null,2));
  throw error;
}

