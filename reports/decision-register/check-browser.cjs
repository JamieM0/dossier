const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('/Users/jamie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Users/jamie/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
 await page.goto('file://'+path.resolve('reports/dossier-decision-register.html')); await page.locator('#reset').click();
 assert.match(await page.locator('#ranking-results').innerText(),/60\.1%/);
 assert.match(await page.locator('#ranking-results').innerText(),/5\.76/);
 assert.equal(await page.evaluate(()=>state.method),'dossier');
 assert.equal(await page.evaluate(()=>state.question),'active');
 assert.match(await page.locator('h1').innerText(),/Improve Dossier/);
 assert.match(await page.locator('#ranking-verdict').innerText(),/keeping its personal model/);
 await page.evaluate(()=>{localStorage.removeItem('dossier-decision-register-v2');localStorage.setItem('dossier-decision-register-v1',JSON.stringify({version:1,state:{method:'candidate',question:'reasonableRandom',count:'40',cohort:'fresh'},notes:{ranking:{status:'Use in next experiment',text:'Keep the 75/25 candidate unchanged. Keep product defaults unchanged.'},matching:{status:'Use in next experiment',text:'Keep separate tastes intact.'}}}));});
 await page.reload();assert.equal(await page.evaluate(()=>state.method),'dossier');assert.equal(await page.inputValue('#note-text-matching'),'Keep separate tastes intact.');assert.equal(await page.inputValue('#note-status-matching'),'Test a repair');assert.match(await page.inputValue('#note-text-ranking'),/Improve Dossier/);await page.locator('#reset').click();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'reports/decision-register/desktop.png',fullPage:false});
 let actions=0;
 for(const cohort of ['fresh','confirmation','original','unusual']){
  await page.selectOption('#cohort',cohort);
  for(const count of ['1','3','5','10','20','40']){
   await page.locator(`#rating-counts [data-value="${count}"]`).click();
   for(const method of ['candidate','publicReviews','dossier']){
    await page.locator(`[data-method="${method}"]`).click();
    const expected=await page.evaluate(()=>{const v=avg(state.cohort,state.count,state.method,state.person);return [(v.auc*100).toFixed(1)+'%',(v.precision10*10).toFixed(2)];});
    const text=await page.locator('#ranking-results').innerText();for(const n of expected)assert.ok(text.includes(n),n+' absent');actions++;
   }
  }
 }
 await page.selectOption('#cohort','unusual'); await page.selectOption('#person','movielens-82');
 await page.locator('[data-method="candidate"]').click();assert.match(await page.locator('#ranking-results').innerText(),/57\.5%/);
 await page.locator('[data-method="dossier"]').click();assert.match(await page.locator('#ranking-results').innerText(),/86\.0%/);
 await page.locator('[data-metric="precision10"]').click();assert.match(await page.locator('#learning-chart svg').getAttribute('aria-label'),/movielens-82/);
 for(const metadata of ['tmdb','bundled']){await page.selectOption('#metadata',metadata);for(const key of await page.locator('#component option').evaluateAll(xs=>xs.map(x=>x.value))){await page.selectOption('#component',key);const text=await page.locator('#component-result').innerText();assert.ok(!/NaN|undefined/.test(text));actions++;}}
 for(const count of ['5','10','20','40'])for(const method of ['active','reasonableRandom']){await page.locator(`#question-counts [data-value="${count}"]`).click();await page.locator(`[data-question="${method}"]`).click();assert.ok(!(await page.locator('#question-result').innerText()).includes('NaN'));actions++;}
 await page.locator('[data-question="reasonableRandom"]').click();assert.match(await page.locator('#question-result').innerText(),/61\.9%/);
 await page.locator('#legacy-switching > summary').click();
 for(const method of ['guard','candidate','dossier','publicReviews']){await page.selectOption('#protection-method',method);for(const n of ['0','1','2','3','4']){await page.selectOption('#failure-case',n);assert.ok(!(await page.locator('#failure-result').innerText()).includes('NaN'));actions++;}}
 for(const n of ['0','1','2','3','4'])for(const key of ['current','freezeLikedContribution','freezeDislikeContribution','freezeClaims']){await page.selectOption('#failure-case',n);await page.selectOption('#failure-diagnostic',key);const expected=await page.evaluate(()=>p100(D.failures[state.failure].interventions[state.repair]));assert.ok((await page.locator('#failure-result').innerText()).includes(expected));assert.match(await page.locator('#failure-chart').innerText(),/Earlier/);actions++;}
 await page.selectOption('#failure-case','0');await page.selectOption('#failure-diagnostic','freezeLikedContribution');assert.match(await page.locator('#failure-result').innerText(),/74\.7%/);assert.match(await page.locator('#failure-result').innerText(),/37\.02/);
 await page.selectOption('#failure-case','3');await page.selectOption('#failure-diagnostic','freezeDislikeContribution');assert.match(await page.locator('#failure-result').innerText(),/69\.6%/);
 for(const n of ['0','1','27']){await page.selectOption('#belief-case',n);for(const stage of ['before','after']){await page.locator(`[data-stage="${stage}"]`).click();assert.ok(!(await page.locator('#belief-result').innerText()).includes('undefined'));actions++;}}
 for(const key of ['intact','reversed_half','randomized','important_removed','contradiction','five_ratings']){await page.selectOption('#damage',key);assert.ok(!(await page.locator('#damage-result').innerText()).includes('NaN'));actions++;}
 await page.fill('#note-text-ranking','Compare the personal losses before changing defaults.');await page.selectOption('#note-status-ranking','Investigate first');
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export-top').click()]);const filename=await download.path();const exported=JSON.parse(fs.readFileSync(filename,'utf8'));assert.equal(exported.decisions.ranking.status,'Investigate first');assert.equal(exported.evidence.people.length,108);assert.equal(exported.productDefaultsChanged,false);assert.match(exported.scope,/existing personal model/);assert.equal(exported.displayedDiagnostic.isProvenRepair,false);assert.equal(exported.version,2);
 await page.reload();assert.equal(await page.inputValue('#note-text-ranking'),'Compare the personal losses before changing defaults.');assert.equal(await page.inputValue('#damage'),'five_ratings');
 await page.locator('#reset').click();
 await page.locator('[data-method="candidate"]').click();await page.selectOption('#reference','dossier');await page.locator('[data-metric="precision10"]').click();assert.equal(await page.locator('#people-table tbody tr').first().locator('button').innerText(),'Viewer 230');
 await page.locator('#reset').click();await page.locator('#legacy-switching').evaluate(el=>el.open=false);
 await page.addStyleTag({content:'.nav{position:static}'});await page.locator('#ranking').screenshot({path:'reports/decision-register/ranking.png'});
 await page.locator('#protection').screenshot({path:'reports/decision-register/protection.png'});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'reports/decision-register/mobile.png',fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,'Page overflows mobile width');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 const prose=await page.evaluate(()=>[...document.querySelectorAll('h1,h2,h3,p,li,.claim,.option b,.option span,.metric .label,.metric .detail')].map(e=>e.innerText.trim()).filter(Boolean).join('\n\n'));
 fs.writeFileSync('reports/decision-register/rendered-copy.md',prose);
 console.log(JSON.stringify({interactionChecks:actions+8,sourcePeople:108,downloadVerified:true,persistenceVerified:true,mobileOverflow:false,browserErrors:errors,externalRequests:external}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
