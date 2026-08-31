// Boot the app the way smoke.js does, then run whatever is in ARG file.
const fs=require('fs'),os=require('os'),path=require('path');
const {chromium}=require('playwright-core');
const REPO=path.join(__dirname,'..','..','..','..','home','user','Weekly-Planner');
function findChromium(){
  if(process.env.SMOKE_CHROMIUM)return process.env.SMOKE_CHROMIUM;
  const roots=[process.env.PLAYWRIGHT_BROWSERS_PATH,'/opt/pw-browsers',
    path.join(os.homedir(),'.cache','ms-playwright')];
  const bins=[['chrome-linux','chrome'],['chrome-linux','headless_shell']];
  for(const r of roots){ if(!r||!fs.existsSync(r))continue;
    for(const d of fs.readdirSync(r)){ if(!d.startsWith('chromium'))continue;
      for(const p of bins){const f=path.join(r,d,...p); if(fs.existsSync(f))return f;}}}
}
(async()=>{
  const browser=await chromium.launch({executablePath:findChromium()});
  const page=await browser.newPage({viewport:{width:900,height:1100},timezoneId:'America/Edmonton'});
  const errs=[]; page.on('pageerror',e=>errs.push(String(e)));
  page.on('console',m=>{if(m.type()==='error'&&!/firestore|firebase|net::|CORS|fetch/i.test(m.text()))errs.push(m.text());});
  for(const p of ['**://firestore.googleapis.com/**','**://*.firebaseio.com/**',
    '**://www.gstatic.com/firebasejs/**','**://identitytoolkit.googleapis.com/**',
    '**://firebaseinstallations.googleapis.com/**']) await page.route(p,r=>r.abort());
  await page.goto('file://'+path.join('/home/user/Weekly-Planner','index.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(()=>selectProfile('jenn'));
  await page.waitForTimeout(400);
  await page.evaluate(()=>{
    const keys=getDayKeys(0);
    setDayBlocks(keys[0],[
      {id:'t1',actId:'breakfast',startMin:7*60+30,durationMin:30,checklistState:{}},
      {id:'t2',actId:'school_day',startMin:9*60,durationMin:360,checklistState:{}},
      {id:'t3',actId:'piano',startMin:16*60,durationMin:60,checklistState:{}},
    ]);
    setDayBlocks(keys[5],[
      {id:'t4',actId:'training',startMin:17*60+30,durationMin:120,tag:'skating',
       travelBuffer:true,travelBufMin:30,getReadyBuffer:true,getReadyBufMin:15,checklistState:{}},
    ]);
    goWeek();
  });
  await page.waitForTimeout(600);
  const body=fs.readFileSync(process.argv[2],'utf8');
  const out=await page.evaluate("("+body+")()");
  console.log(JSON.stringify(out,null,2));
  if(errs.length)console.log('PAGE ERRORS:',errs.slice(0,5));
  await browser.close();
})();
