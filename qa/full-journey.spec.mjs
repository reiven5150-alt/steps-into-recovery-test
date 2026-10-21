import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE='http://127.0.0.1:4173/full-journey.html?code=QA-TEST-CODE&v=11.1.0';
const AUTH='**/functions/v1/full-journey-authorize';
const FREE='http://127.0.0.1:4173/index.html';
const PURCHASE='http://127.0.0.1:4173/purchase.html?session_id=cs_test_qa&v=11.1.0';
const FACILITY_STAFF='http://127.0.0.1:4173/facility-staff.html?v=11.1.0';
const PLANS='http://127.0.0.1:4173/plans.html';
const PURCHASE_API='**/functions/v1/purchase-complete*';
const STAFF_API='**/functions/v1/facility-staff*';

async function authorize(page, ok=true){
  await page.route(AUTH, route=>route.fulfill({
    status: ok?200:403,
    contentType:'application/json',
    body:JSON.stringify(ok?{authorized:true,entitlement_type:'full_journey',audience:'individual'}:{authorized:false,error:'invalid_code'})
  }));
}
async function assertNoErrors(errors,label){
  assert.equal(errors.length,0,label+' page errors: '+errors.map(String).join(' | '));
}
async function openPlace(page,id){
  const marker=page.locator('.location[data-place="'+id+'"]');
  assert.equal(await marker.count(),1,'Map marker must exist for '+id);
  await page.evaluate(id=>travelTo(id),id);
  await page.locator('#sceneModal.open').waitFor({state:'visible',timeout:5000});
}
async function continueCoach(page){
  await page.locator('#coachOwn').waitFor({state:'visible',timeout:4000});
  await page.locator('#coachOwn').click();
}
async function returnMap(page){
  const b=page.locator('.returnMap');
  await b.waitFor({state:'visible',timeout:3000});
  await b.click();
  await page.locator('#sceneModal').waitFor({state:'hidden',timeout:3000});
}
async function completeGround(page){
  await openPlace(page,'park');
  await page.locator('.moveg').first().waitFor({state:'visible'});
  await page.locator('.moveg').first().click();
  await page.evaluate(()=>{
    challenge.objects=[
      {x:challenge.x,y:challenge.y,t:'pickup',e:'1'},
      {x:challenge.x,y:challenge.y,t:'pickup',e:'2'},
      {x:challenge.x,y:challenge.y,t:'pickup',e:'3'},
      {x:challenge.x,y:challenge.y,t:'pickup',e:'4'},
      {x:challenge.x,y:challenge.y,t:'pickup',e:'5'}
    ];
    checkGround();
  });
  await page.locator('#sceneModal').waitFor({state:'hidden',timeout:3000});
}
async function completeSupport(page){
  await openPlace(page,'support');
  await page.locator('#supportNeed').fill('I need someone safe to talk with tonight.');
  await page.locator('#supportAsk').fill('Can you check in with me after dinner?');
  await page.locator('#supportBoundary').fill('If not, I will call another support person.');
  await page.locator('#saveSupport').click();
  await continueCoach(page);
  await page.locator('.sceneStatus').waitFor();
  await returnMap(page);
}
async function completeMeeting(page){
  await openPlace(page,'meeting');
  await page.locator('#meetingShare').fill('Today I am choosing to ask for support instead of isolating.');
  await page.locator('#submitShare').click();
  await continueCoach(page);
  await page.locator('.sceneStatus').waitFor();
  assert.match(await page.locator('.sceneStatus').innerText(),/shared/i);
  await returnMap(page);
}
async function completeMarket(page){
  await openPlace(page,'market');
  await page.locator('.item').filter({hasText:'Fruit'}).click();
  await page.locator('.item').filter({hasText:'Protein'}).click();
  await page.locator('.item').filter({hasText:'Bread'}).click();
  await page.locator('#budgetSubmit').click();
  await page.locator('#sceneModal').waitFor({state:'hidden',timeout:3000});
}
async function completeHome(page){
  await openPlace(page,'home');
  await page.locator('#homeNote').fill('Eat, shower, text a safe person, and keep tonight simple.');
  await page.locator('#saveHomePlan').click();
  await continueCoach(page);
  await page.locator('.sceneStatus').waitFor();
  await returnMap(page);
}
async function completeCafe(page){
  await openPlace(page,'cafe');
  await page.locator('.sceneChoice').first().click();
  await page.locator('.sceneStatus').waitFor();
  await returnMap(page);
}
async function completeBreath(page){
  await openPlace(page,'gym');
  for(let i=0;i<6;i++){
    await page.evaluate(()=>{ if(challenge) challenge.pos=50; });
    await page.locator('#breathTap').click();
    if(i<5) await page.locator('#breathTap').waitFor();
  }
  await page.locator('#sceneModal').waitFor({state:'hidden',timeout:3000});
}
async function completeLibrary(page){
  await openPlace(page,'library');
  await page.locator('#libraryNote').fill('Calling someone and slowing down helped me get through a hard night.');
  await page.locator('#saveReflection').click();
  await continueCoach(page);
  await page.locator('.sceneStatus').waitFor();
  await returnMap(page);
}
async function completeWork(page){
  await openPlace(page,'work');
  await page.locator('.sceneChoice').first().click();
  await page.locator('.sceneStatus').waitFor();
  await returnMap(page);
}

const browser=await chromium.launch({headless:true});
try{
  // 1. Desktop full journey, all locations, all 3 days.
  const ctx=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>{errors.push(e);console.error('PAGEERROR',e.message)});
  await authorize(page,true);
  const resp=await page.goto(BASE,{waitUntil:'domcontentloaded'});
  assert.equal(resp.status(),200);
  assert.match(resp.headers()['content-type']||'',/text\/html/i,'Local host must serve HTML');
  await page.locator('#start').waitFor({state:'visible'});
  assert.equal(await page.locator('#app').getAttribute('data-build'),'11.1.0');
  assert.equal(await page.locator('#freeMode').isVisible(),false);
  const paidInventory=await page.evaluate(()=>({coreSkills:Object.keys(skills).length,copingTools:Object.keys(copingTools).length,locations:Object.keys(places).length,coach:typeof showRecoveryCoach==='function',wordSearch:typeof openWordSearch==='function'}));
  assert.equal(paidInventory.coreSkills,8);
  assert.ok(paidInventory.copingTools>=25,'Paid build must include the expanded coping-tool library');
  assert.equal(paidInventory.locations,10);
  assert.equal(paidInventory.coach,true);
  assert.equal(paidInventory.wordSearch,true);
  assert.match(await page.locator('#paidMode').innerText(),/Full Journey Access/);
  await page.locator('#startBtn').click();
  await page.locator('#game.active').waitFor();

  // Day 1.
  await completeGround(page);
  await completeSupport(page);
  await completeMeeting(page);
  await completeMarket(page);
  await page.locator('#end.active').waitFor({timeout:4000});
  assert.match(await page.locator('#endTitle').innerText(),/Day 1 complete/);
  await page.locator('#nextBtn').click();
  assert.match(await page.locator('#clock').innerText(),/Day 2/);

  // Day 2.
  await completeHome(page);
  await completeCafe(page);
  await completeBreath(page);
  await completeLibrary(page);
  await completeWork(page);
  await page.locator('#end.active').waitFor({timeout:4000});
  assert.match(await page.locator('#endTitle').innerText(),/Day 2 complete/);
  await page.locator('#nextBtn').click();
  assert.match(await page.locator('#clock').innerText(),/Day 3/);

  // Save/continue survives reload and stays paid.
  await page.locator('#saveBtn').click();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#start').waitFor({state:'visible'});
  await page.locator('#continueBtn').click();
  await page.locator('#game.active').waitFor();
  assert.match(await page.locator('#clock').innerText(),/FULL JOURNEY · Day 3/);

  // Day 3 boss opens, skill works, completion advances to final screen.
  await page.evaluate(()=>{
    s.unlocked=Object.keys(skills);
    s.equipped=['deep','ground','self','urge'];
    Object.keys(s.cooldowns).forEach(k=>delete s.cooldowns[k]);
    renderWorld();
  });
  await openPlace(page,'oldspot');
  const before=await page.evaluate(()=>challenge.pressure);
  await page.locator('.bossSkill').first().click();
  const after=await page.evaluate(()=>challenge.pressure);
  assert.ok(after<before,'Boss skill should reduce pressure');
  await page.evaluate(()=>finishBoss());
  await page.locator('#end.active').waitFor({timeout:4000});
  assert.match(await page.locator('#endTitle').innerText(),/Full Journey complete/);
  await page.locator('#nextBtn').click();
  await page.locator('#game.active').waitFor();

  // Toolbox and journal.
  await page.locator('#toolBtn').click();
  await page.locator('#toolModal.open').waitFor();
  assert.ok(await page.locator('.toolCard').count()>=8);
  await page.locator('#closeTools').click();
  await page.locator('#journalBtn').click();
  await page.locator('#journalModal.open').waitFor();
  await page.locator('#journalWrite').fill('This is a saved QA journal entry.');
  await page.locator('#saveJournalEntry').click();
  assert.match(await page.locator('#savedJournalEntries').innerText(),/saved QA journal entry/i);
  await page.locator('#journeyLogTab').click();
  assert.match(await page.locator('#journalList').innerText(),/Home Base plan/);
  assert.match(await page.locator('#journalList').innerText(),/Meeting share/);
  assert.match(await page.locator('#journalList').innerText(),/Reflection Library/);
  await page.locator('#closeJournal').click();
  await page.locator('#gamesBtn').click();
  await page.locator('#gamesModal.open').waitFor();
  assert.match(await page.locator('#gamesGrid').innerText(),/Recovery Word Search/);
  assert.match(await page.locator('#gamesGrid').innerText(),/Breathing Rhythm/);
  await page.locator('[data-game="wordsearch"]').click();
  await page.locator('#wsGrid').waitFor({state:'visible'});
  assert.equal(await page.locator('#wsGrid .wsCell').count(),100);
  await page.locator('#miniBack').click();
  await page.locator('#gamesModal.open').waitFor();
  await page.locator('#closeGames').click();
  await assertNoErrors(errors,'desktop');
  await ctx.close();

  // 2. Mobile form input + scrolling + navigation controls.
  const mobile=await browser.newContext({
    viewport:{width:390,height:844},
    isMobile:true,
    hasTouch:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
  });
  const mp=await mobile.newPage();const mobileErrors=[];mp.on('pageerror',e=>{mobileErrors.push(e);console.error('MOBILE PAGEERROR',e.message)});
  await authorize(mp,true);
  await mp.goto(BASE,{waitUntil:'domcontentloaded'});
  await mp.locator('#startBtn').click();
  await mp.locator('#game.active').waitFor();
  assert.equal(await mp.locator('.dpad').isVisible(),true);
  await openPlace(mp,'meeting');
  await mp.locator('#meetingShare').fill('Mobile typing works and my response remains editable.');
  assert.match(await mp.locator('#meetingShare').inputValue(),/Mobile typing works/);
  const scroll=await mp.locator('#sceneBox').evaluate(el=>{const before=el.scrollTop;el.scrollTop=el.scrollHeight;return {before,after:el.scrollTop,height:el.scrollHeight,client:el.clientHeight}});
  assert.ok(scroll.height>=scroll.client,'Scene must fit or scroll on mobile');
  await mp.locator('#submitShare').click();
  await continueCoach(mp);
  await mp.locator('.sceneStatus').waitFor();
  await returnMap(mp);
  await openPlace(mp,'home');
  assert.equal(await mp.locator('#sceneClose').isVisible(),true);
  await mp.locator('#sceneClose').click();
  await mp.locator('#sceneModal').waitFor({state:'hidden'});
  await assertNoErrors(mobileErrors,'mobile');
  await mobile.close();

  // 3. Public Free Journey remains functional and correctly limited.
  const freeCtx=await browser.newContext({viewport:{width:1280,height:900}});
  const freePage=await freeCtx.newPage();const freeErrors=[];freePage.on('pageerror',e=>freeErrors.push(e));
  const freeResp=await freePage.goto(FREE,{waitUntil:'domcontentloaded'});
  assert.equal(freeResp.status(),200);
  assert.match(freeResp.headers()['content-type']||'',/text\/html/i);
  await freePage.locator('#startBtn').click();
  await freePage.locator('#game.active').waitFor();
  const freeState=await freePage.evaluate(()=>({mode:s.mode,levelCap:s.levelCap,coach:typeof showRecoveryCoach==='function',wordSearch:typeof openWordSearch==='function'}));
  assert.equal(freeState.mode,'free');
  assert.equal(freeState.levelCap,3);
  assert.equal(freeState.coach,true);
  assert.equal(freeState.wordSearch,true);
  assert.equal(await freePage.locator('.location').count(),6,'Free Journey must expose exactly six Chapter One locations');
  assert.equal(await freePage.locator('.location[data-place="gym"]').count(),0);
  assert.equal(await freePage.locator('.location[data-place="library"]').count(),0);
  assert.equal(await freePage.locator('.location[data-place="work"]').count(),0);
  assert.equal(await freePage.locator('.location[data-place="oldspot"]').count(),0);
  await freePage.locator('#journalBtn').click();
  await freePage.locator('#journalModal.open').waitFor();
  await freePage.locator('#journalWrite').fill('Free Journey journal QA entry.');
  await freePage.locator('#saveJournalEntry').click();
  assert.match(await freePage.locator('#savedJournalEntries').innerText(),/Free Journey journal QA entry/);
  await freePage.locator('#closeJournal').click();
  await freePage.locator('#gamesBtn').click();
  await freePage.locator('#gamesModal.open').waitFor();
  await freePage.locator('[data-game="wordsearch"]').click();
  await freePage.locator('#wsGrid').waitFor();
  assert.equal(await freePage.locator('#wsGrid .wsCell').count(),100);
  await freePage.locator('#miniBack').click();
  await freePage.locator('#closeGames').click();
  await freePage.evaluate(()=>nextDay());
  await freePage.locator('#sceneModal.open').waitFor();
  assert.match(await freePage.locator('#sceneBox').innerText(),/FULL JOURNEY|paid access/i,'Free Journey must stop at the paid boundary');
  await assertNoErrors(freeErrors,'free journey');
  await freeCtx.close();

  // 4. Pricing page exposes the free entry plus exactly 10 live paid Stripe choices.
  const plansCtx=await browser.newContext({viewport:{width:1280,height:900}});
  const plansPage=await plansCtx.newPage();const plansErrors=[];plansPage.on('pageerror',e=>plansErrors.push(e));
  const plansResp=await plansPage.goto(PLANS,{waitUntil:'domcontentloaded'});
  assert.equal(plansResp.status(),200);
  assert.match(plansResp.headers()['content-type']||'',/text\/html/i);
  assert.equal(await plansPage.locator('a[href^="https://buy.stripe.com/"]').count(),10);
  const plansText=await plansPage.locator('body').innerText();
  for(const label of ['Full Journey','Game Plus','Recovery Resource Membership','Facility Full Journey','Facility Game Plus','Facility Recovery Membership']) assert.match(plansText,new RegExp(label));
  assert.match(plansText,/Play Chapter One Free/);
  await assertNoErrors(plansErrors,'plans');
  await plansCtx.close();

  // 5. Individual paid purchase handoff renders a normal hosted page and opens current Full Journey.
  const buyCtx=await browser.newContext({viewport:{width:390,height:844}});
  const buyPage=await buyCtx.newPage();const buyErrors=[];buyPage.on('pageerror',e=>buyErrors.push(e));
  await buyPage.route(PURCHASE_API,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    status:'ready',access_code:'SIR-ACC-QATEST-123456',
    access_url:'https://reiven5150-alt.github.io/steps-into-recovery-test/full-journey.html?code=SIR-ACC-QATEST-123456&v=11.0.0',
    member_discount:null
  })}));
  const buyResp=await buyPage.goto(PURCHASE,{waitUntil:'domcontentloaded'});
  assert.match(buyResp.headers()['content-type']||'',/text\/html/i);
  await buyPage.getByText(/access is ready/i).waitFor();
  const buyHref=await buyPage.locator('#gameLink').getAttribute('href');
  assert.match(buyHref,/full-journey\.html\?code=SIR-ACC-QATEST-123456/);
  assert.match(buyHref,/v=11\.1\.0/,'Purchase page must normalize buyers to current game build');
  assert.doesNotMatch(await buyPage.locator('body').innerText(),/Deno\.serve|const supabase|<!doctype html>/i);
  await assertNoErrors(buyErrors,'individual purchase');
  await buyCtx.close();

  // 6. Facility purchase activation produces game and staff-management access.
  const facilityCtx=await browser.newContext({viewport:{width:1280,height:900}});
  const facilityPage=await facilityCtx.newPage();const facilityErrors=[];facilityPage.on('pageerror',e=>facilityErrors.push(e));
  await facilityPage.route(PURCHASE_API,route=>{
    if(route.request().method()==='POST') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      status:'facility_active',facility_active:true,facility_license_code:'SIR-FAC-QATEST-123456',
      access_code:'SIR-ACC-FACILITY-123456',
      access_url:'https://reiven5150-alt.github.io/steps-into-recovery-test/full-journey.html?code=SIR-ACC-FACILITY-123456&v=11.0.0'
    })});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      status:'facility_activation_required',facility_license_code:'SIR-FAC-QATEST-123456',admin_email:'admin@example.com'
    })});
  });
  await facilityPage.goto(PURCHASE,{waitUntil:'domcontentloaded'});
  await facilityPage.locator('#facilityForm h2').filter({hasText:/Activate your facility license/i}).waitFor();
  await facilityPage.locator('input[name="facility_name"]').fill('QA Recovery Center');
  await facilityPage.locator('input[name="address1"]').fill('100 Test Way');
  await facilityPage.locator('input[name="city"]').fill('Greeley');
  await facilityPage.locator('input[name="state"]').fill('CO');
  await facilityPage.locator('input[name="postal_code"]').fill('80631');
  await facilityPage.locator('#facilityForm button[type="submit"]').click();
  await facilityPage.getByText(/Facility access is ready/i).waitFor();
  assert.equal(await facilityPage.locator('#staffLink').isVisible(),true);
  assert.match(await facilityPage.locator('#staffLink').getAttribute('href'),/facility-staff\.html\?admin_code=/);
  assert.match(await facilityPage.locator('#gameLink').getAttribute('href'),/v=11\.1\.0/);
  await assertNoErrors(facilityErrors,'facility purchase');
  await facilityCtx.close();

  // 7. Facility administrator can create a staff invite; staff can redeem to Full Journey.
  const adminCtx=await browser.newContext({viewport:{width:1280,height:900}});
  const adminPage=await adminCtx.newPage();const adminErrors=[];adminPage.on('pageerror',e=>adminErrors.push(e));
  await adminPage.route(STAFF_API,route=>{
    if(route.request().method()==='POST') return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      status:'invite_created',staff_email:'staff@example.com',
      invite_url:'https://reiven5150-alt.github.io/steps-into-recovery-test/facility-staff.html?email=staff%40example.com&invite_code=SIR-STAFF-QATEST-123456&v=11.0.0'
    })});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      status:'ready',facility:{facility_name:'QA Recovery Center',address1:'100 Test Way',city:'Greeley',state:'CO',postal_code:'80631'},staff:[]
    })});
  });
  await adminPage.goto(FACILITY_STAFF.replace('?v=11.1.0','?admin_code=SIR-ACC-FACILITY-123456&v=11.1.0'),{waitUntil:'domcontentloaded'});
  await adminPage.getByText(/Administrator access verified/i).waitFor();
  await adminPage.locator('#staffEmail').fill('staff@example.com');
  await adminPage.locator('#inviteForm button').click();
  await adminPage.getByText(/Private invitation for staff@example.com/i).waitFor();
  assert.match(await adminPage.locator('#inviteResult').innerText(),/facility-staff\.html\?email=/);
  await assertNoErrors(adminErrors,'facility admin');
  await adminCtx.close();

  const staffCtx=await browser.newContext({viewport:{width:390,height:844}});
  const staffPage=await staffCtx.newPage();const staffErrors=[];staffPage.on('pageerror',e=>staffErrors.push(e));
  await staffPage.route(STAFF_API,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    status:'staff_active',access_code:'SIR-STAFF-QATEST-123456',
    access_url:'https://reiven5150-alt.github.io/steps-into-recovery-test/full-journey.html?code=SIR-STAFF-QATEST-123456&v=11.0.0'
  })}));
  await staffPage.goto('http://127.0.0.1:4173/facility-staff.html?email=staff%40example.com&invite_code=SIR-STAFF-QATEST-123456&v=11.1.0',{waitUntil:'domcontentloaded'});
  await staffPage.getByText(/Staff access ready/i).waitFor();
  assert.match(await staffPage.locator('#staffGameLink').getAttribute('href'),/v=11\.1\.0/);
  assert.doesNotMatch(await staffPage.locator('body').innerText(),/Deno\.serve|const supabase|<!doctype html>/i);
  await assertNoErrors(staffErrors,'facility staff');
  await staffCtx.close();

  // 3. Invalid authorization fails cleanly instead of exposing source.
  const bad=await browser.newContext({viewport:{width:390,height:844}});
  const bp=await bad.newPage();const badErrors=[];bp.on('pageerror',e=>badErrors.push(e));
  await authorize(bp,false);
  await bp.goto(BASE,{waitUntil:'domcontentloaded'});
  await bp.getByText(/invalid or inactive/i).waitFor({timeout:4000});
  const body=await bp.locator('body').innerText();
  assert.doesNotMatch(body,/<!doctype|function fresh\(|const ASSET=/i,'Source code must never be displayed to customer');
  await assertNoErrors(badErrors,'unauthorized');
  await bad.close();

  console.log('STEPS INTO RECOVERY QA PASS: free + paid + mobile + auth + 10 locations + 3 days + journal + games + purchase + facility + staff');
} finally {
  await browser.close();
}
