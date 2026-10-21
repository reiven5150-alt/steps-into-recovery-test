import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE='http://127.0.0.1:4173/full-journey.html?code=QA-TEST-CODE&v=11.1.0';
const AUTH='**/functions/v1/full-journey-authorize';

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

  console.log('FULL JOURNEY QA PASS: desktop + mobile + auth + 10 locations + 3 days + save/load');
} finally {
  await browser.close();
}
