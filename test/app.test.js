import test from 'node:test';
import assert from 'node:assert/strict';
test('application routes, translations, completion, plan and quiz persistence',async()=>{
 const elements=new Map(),handlers={},storage=new Map();
 const get=s=>{if(!elements.has(s))elements.set(s,{innerHTML:'',value:'',focus(){},scrollTop:0,scrollHeight:0});return elements.get(s)};
 globalThis.document={documentElement:{},title:'',querySelector:get,addEventListener:(event,fn)=>{handlers[event]=fn}};
 globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 globalThis.location={hash:''};globalThis.window={scrollTo(){},addEventListener(){}};
 await import('../src/app.js');
 const click=(action,extra={})=>handlers.click({target:{closest:()=>({dataset:{action,...extra}})}});
 const html=()=>get('#app').innerHTML;
 assert.match(html(),/Қош келдің/);
 for(const lang of ['ru','en','kk']){get('#language').onchange({target:{value:lang}});assert.equal(document.documentElement.lang,lang);assert.ok(!html().includes('undefined'))}
 get('#language').onchange({target:{value:'en'}});
 for(const page of ['courses','tests','tutor','plan','progress','settings','home']){click('nav',{page});assert.match(html(),/<main>/);assert.ok(!html().includes('undefined'))}
 click('lesson',{id:'equations'});assert.match(html(),/3x/);click('complete',{id:'equations'});click('complete',{id:'equations'});
 click('toggle-plan',{id:'equations'});
 let saved=JSON.parse(storage.get('tenbilim.v1'));assert.deepEqual(saved.completed,['equations']);assert.deepEqual(saved.plan,['equations']);
 click('nav',{page:'tests'});get('#test-subject').value='math';click('begin');
 for(const index of [1,2,1]){click('answer',{index:String(index)});click('next')}
 assert.match(html(),/Review your answers/);saved=JSON.parse(storage.get('tenbilim.v1'));assert.equal(saved.attempts.length,1);assert.equal(saved.attempts[0].score,3);assert.equal(saved.attempts[0].total,3);
 click('nav',{page:'settings'});get('#profile-name').value='<script>alert(1)</script>';get('#profile-form').onsubmit({preventDefault(){}});assert.ok(!html().includes('<script>'));assert.match(html(),/&lt;script&gt;/);
 click('nav',{page:'tutor'});click('ask-topic',{id:'binary'});assert.match(html(),/Computers store information in bits/);
});

