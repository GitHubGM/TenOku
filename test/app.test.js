import test from 'node:test';
import assert from 'node:assert/strict';
import {extraStrings,aiErrorKeys} from '../src/account-i18n.js';

// Missing selectors return null; each render creates fresh nodes, like the browser.
function createDocument() {
 let markup='',nodes=new Map();const handlers={};
 const attrs=s=>Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
 const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
 function node(tag,raw,content='',id='') {
  const a=attrs(raw),options=tag==='select'?[...content.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map(m=>({value:decode(attrs(m[1]).value||''),selected:/\bselected\b/.test(m[1])})):[];
  return {tagName:tag.toUpperCase(),id,value:tag==='select'?(options.find(o=>o.selected)||options[0])?.value||'':decode(a.value||''),dataset:Object.fromEntries(Object.entries(a).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),decode(v)])),disabled:/\bdisabled\b/.test(raw),options,focus(){},scrollTop:0,scrollHeight:100,textContent:''};
 }
 const app={get innerHTML(){return markup},set innerHTML(value){markup=value;nodes=new Map()}};
 function select(selector) {
  if(selector==='#app')return app;if(nodes.has(selector))return nodes.get(selector);
  for(const m of markup.matchAll(/<(\w+)\b([^>]*)>/g)){const [,tag,raw]=m,a=attrs(raw);const found=selector.startsWith('#')?a.id===selector.slice(1):selector.startsWith('.')?(a.class||'').split(' ').includes(selector.slice(1)):false;if(!found)continue;const content=markup.slice(m.index+m[0].length).split(`</${tag}>`)[0],el=node(tag,raw,content,a.id);nodes.set(selector,el);return el}return null;
 }
 function selectAll(selector) {if(selector!=='[data-user-role]')return [];return [...markup.matchAll(/<select\b([^>]*data-user-role="[^"]+"[^>]*)>([\s\S]*?)<\/select>/g)].map((m,i)=>{const key=`role-${i}`;if(!nodes.has(key))nodes.set(key,node('select',m[1],m[2]));return nodes.get(key)})}
 function findButton(action,extra={}) {for(const m of markup.matchAll(/<button\b([^>]*)>/g)){const el=node('button',m[1]);if(el.dataset.action===action&&Object.entries(extra).every(([k,v])=>el.dataset[k]===String(v)))return el}throw new Error(`No rendered button ${action} ${JSON.stringify(extra)}`)}
 function formEntries(form) {const content=markup.match(new RegExp(`<form\\b[^>]*id="${form.id}"[^>]*>([\\s\\S]*?)<\\/form>`))?.[1]||'',entries=[];for(const m of content.matchAll(/<(input|select)\b([^>]*)>/g)){const a=attrs(m[2]);if(!a.name)continue;const el=select('#'+a.id);if(m[1]==='select'&&/\bmultiple\b/.test(m[2])){for(const option of el.options)if(option.selected)entries.push([a.name,option.value])}else entries.push([a.name,el.value])}return entries}
 return {document:{documentElement:{},title:'',querySelector:select,querySelectorAll:selectAll,addEventListener:(event,fn)=>{handlers[event]=fn}},select,findButton,formEntries,handlers,html:()=>markup};
}

test('guest learning, account isolation, role workspaces, live tutor and logout',async()=>{
 const dom=createDocument(),storage=new Map(),calls=[];
 globalThis.document=dom.document;globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 globalThis.location={hash:''};globalThis.window={scrollTo(){},addEventListener(){}};globalThis.confirm=()=>true;
 globalThis.FormData=class {constructor(form){this.entries=dom.formEntries(form)}[Symbol.iterator](){return this.entries[Symbol.iterator]()}get(k){return this.entries.find(([name])=>name===k)?.[1]??null}getAll(k){return this.entries.filter(([name])=>name===k).map(([,v])=>v)}};
 const blank=()=>({completed:[],dates:{},plan:[],attempts:[]});let apiUser=null,progress={...blank(),completed:['binary'],plan:['percent']};
 const users={student:{id:1,name:'Learner <script>alert(1)</script>',email:'student@example.test',role:'student'},teacher:{id:2,name:'Teacher One',email:'teacher@example.test',role:'teacher'},admin:{id:3,name:'Admin One',email:'admin@example.test',role:'admin'}};
 const assignments=[{id:1,teacherId:2,studentId:1,lessonId:'equations',completed:false}];
 const response=data=>({ok:true,status:200,json:async()=>structuredClone(data)});
 let pendingChat=null,pendingProfile=null;
 globalThis.fetch=async(url,options={})=>{const body=options.body?JSON.parse(options.body):undefined,path=url.replace('/api','');calls.push({path,...options,body});
  if(path==='/session')return response({user:apiUser,csrfToken:apiUser?'test-csrf':null,aiEnabled:true});
  if(path==='/auth/login'){apiUser=users[body.email.split('@')[0]];assert.ok(apiUser);return response({user:apiUser,csrfToken:'test-csrf',aiEnabled:true})}
  if(path==='/auth/logout'){apiUser=null;return response({ok:true})}
  if(path==='/progress'&&options.method==='GET')return response(progress);
  if(path==='/progress/complete'){progress.completed=[...new Set([...progress.completed,body.lessonId])];return response(progress)}
  if(path==='/progress/plan'){progress.plan=body.plan;return response(progress)}
  if(path==='/admin/users')return response({users:Object.values(users)});
  if(path==='/admin/assignments')return response({assignments});
  if(path==='/teacher/students')return response({students:[{...users.student,progress}]});
  if(path==='/teacher/assignments'||path==='/assignments')return response({assignments});
  if(path==='/chat')return pendingChat?pendingChat.promise:response({reply:'Try <script>unsafe()</script> & reason step by step.'});
  if(path==='/profile')return pendingProfile.promise;
  throw new Error(`Unexpected API ${options.method} ${path}`);
 };
 const {ready}=await import('../src/app.js');await ready;
 const click=async(action,extra={})=>{const button=dom.findButton(action,extra);return dom.handlers.click({target:{closest:()=>button}})};
 const language=lang=>dom.select('#language').onchange({target:{value:lang}});
 const submit=async id=>{const form=dom.select(id);assert.ok(form,`${id} exists`);await form.onsubmit({target:form,preventDefault(){}})};
 const login=async role=>{await click('nav',{page:'auth'});dom.select('#auth-email').value=`${role}@example.test`;dom.select('#auth-password').value='a-long-test-password';await submit('#auth-form')};
 assert.equal(dom.select('#auth-form'),null);assert.equal(document.documentElement.lang,'kk');
 for(const lang of ['ru','en','kk']){language(lang);assert.equal(document.documentElement.lang,lang);assert.ok(!dom.html().includes('undefined'))}language('en');
 for(const page of ['courses','tests','tutor','plan','progress','settings','home']){await click('nav',{page});assert.match(dom.html(),/<main>/);assert.ok(!dom.html().includes('undefined'))}
 await click('lesson',{id:'equations'});await click('complete',{id:'equations'});await click('toggle-plan',{id:'equations'});
 let guest=JSON.parse(storage.get('tenbilim.v1'));assert.deepEqual(guest.completed,['equations']);assert.deepEqual(guest.plan,['equations']);
 await click('nav',{page:'tests'});dom.select('#test-subject').value='math';await click('begin');
 for(const index of [1,2,1]){await click('answer',{index});await click('next')}
 assert.match(dom.html(),/Review your answers/);guest=JSON.parse(storage.get('tenbilim.v1'));assert.equal(guest.attempts[0].score,3);assert.equal(calls.filter(c=>c.path==='/attempts').length,0);
 await login('student');assert.ok(!dom.html().includes('<script>alert'));assert.match(dom.html(),/Learner &lt;script&gt;/);assert.ok(!dom.html().includes('data-page="admin"'));assert.ok(!dom.html().includes('data-page="teacher"'));
 await click('nav',{page:'plan'});assert.ok(dom.html().includes('data-action="lesson" data-id="percent"'));assert.ok(!dom.html().includes('data-action="lesson" data-id="equations"'));assert.deepEqual(JSON.parse(storage.get('tenbilim.v1')).plan,['equations'],'server data must not overwrite guest cache');
 await click('nav',{page:'courses'});await click('lesson',{id:'equations'});await click('complete',{id:'equations'});const completion=calls.find(c=>c.path==='/progress/complete');assert.deepEqual(completion.body,{lessonId:'equations'});assert.equal(completion.headers['X-CSRF-Token'],'test-csrf');
 await click('nav',{page:'assignments'});assert.match(dom.html(),/Teacher assignment/);
 await click('nav',{page:'tutor'});assert.ok(dom.html().includes(extraStrings.en.aiNote),'older sessions without aiProvider keep the OpenAI notice');await click('ask-topic',{id:'binary'});const chatCall=calls.find(c=>c.path==='/chat');assert.equal(chatCall.body.lang,'en');assert.deepEqual(chatCall.body.history,[]);assert.equal(chatCall.credentials,'same-origin');assert.match(dom.html(),/&lt;script&gt;unsafe\(\)&lt;\/script&gt;/);assert.ok(!dom.html().includes('<script>unsafe'));
 for(const lang of ['kk','ru','en']){
  language(lang);
  for(const code of ['AI_AUTH_FAILED','AI_QUOTA_EXCEEDED','AI_MODEL_UNAVAILABLE','AI_CONNECTION_FAILED','AI_TIMEOUT']){
   pendingChat={promise:Promise.resolve({ok:false,status:502,json:async()=>({code,error:'DO NOT DISPLAY provider details or secrets'})})};
   await click('ask-topic',{id:'binary'});
   assert.ok(dom.html().includes(extraStrings[lang][aiErrorKeys[code]]),`${lang}: ${code} has actionable text`);
   assert.ok(!dom.html().includes('DO NOT DISPLAY'));
   assert.ok(dom.findButton('logout'),'upstream authentication failure must not sign the student out');
  }
 }
 language('en');
 pendingChat={};pendingChat.promise=new Promise(resolve=>{pendingChat.resolve=resolve});
 const oldChat=click('ask-topic',{id:'binary'});
 await click('logout');assert.ok(!dom.html().includes('Learner'));await click('nav',{page:'tutor'});assert.ok(!dom.html().includes('unsafe()'));assert.match(dom.html(),/Sign in to continue/);
 pendingChat.resolve(response({reply:'PRIVATE LATE REPLY'}));await oldChat;pendingChat=null;assert.ok(!dom.html().includes('PRIVATE LATE REPLY'),'late AI responses must not appear after logout');
 await click('nav',{page:'plan'});assert.ok(dom.html().includes('data-action="lesson" data-id="equations"'));assert.ok(!dom.html().includes('data-action="lesson" data-id="percent"'));
 await login('teacher');assert.ok(dom.select('#teacher-assignment-form'));assert.match(dom.html(),/Teacher One/);assert.match(dom.html(),/Learner &lt;script&gt;/);assert.ok(!dom.html().includes('data-page="admin"'));assert.ok(calls.some(c=>c.path==='/teacher/students'));
 await click('nav',{page:'settings'});pendingProfile={};pendingProfile.promise=new Promise(resolve=>{pendingProfile.resolve=resolve});dom.select('#profile-name').value='Teacher Updated';const profileSave=submit('#profile-form');await click('nav',{page:'home'});pendingProfile.resolve(response({user:{...users.teacher,name:'Teacher Updated'}}));await assert.doesNotReject(profileSave,'profile save can complete after navigating away');pendingProfile=null;
 await click('logout');assert.equal(dom.select('#teacher-assignment-form'),null);assert.ok(!dom.html().includes('Teacher Updated'));
 await login('admin');assert.ok(dom.select('#create-user-form'));assert.ok(dom.select('#assignment-form'));assert.equal(document.querySelectorAll('[data-user-role]').length,3);
 dom.select('#roster-teacher').value='2';dom.select('#roster-teacher').onchange({target:dom.select('#roster-teacher')});assert.equal(dom.select('#roster-students').options[0].selected,true);
 await click('logout');assert.equal(dom.select('#create-user-form'),null);assert.equal(dom.select('#assignment-form'),null);assert.ok(!dom.html().includes('admin@example.test'));
});

test('local tutor uses its provider notice and localized errors without OpenAI setup advice',async()=>{
 const dom=createDocument(),storage=new Map([['tenbilim.v1',JSON.stringify({lang:'en'})]]);
 globalThis.document=dom.document;
 globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 globalThis.location={hash:'#tutor'};
 globalThis.window={scrollTo(){},addEventListener(){}};
 const user={id:'local-student',name:'Local learner',email:'local@example.test',role:'student'};
 let failure=null;
 globalThis.fetch=async(url)=>{
  if(url==='/api/session')return {ok:true,status:200,json:async()=>({user,csrfToken:'local-csrf',aiEnabled:true,aiProvider:'ollama'})};
  if(url==='/api/progress')return {ok:true,status:200,json:async()=>({completed:[],dates:{},plan:[],attempts:[]})};
  if(url==='/api/chat')return failure
   ?{ok:false,status:503,json:async()=>({code:failure,error:'PRIVATE provider response'})}
   :{ok:true,status:200,json:async()=>({reply:'A local answer.'})};
  throw new Error(`Unexpected local tutor request ${url}`);
 };
 const {ready}=await import('../src/app.js?local-ollama-test');await ready;
 const ask=async()=>{const button=dom.findButton('ask-topic',{id:'binary'});await dom.handlers.click({target:{closest:()=>button}})};
 for(const lang of ['en','kk','ru']){
  dom.select('#language').onchange({target:{value:lang}});
  assert.ok(dom.html().includes(extraStrings[lang].localAI),'local model badge is translated');
  assert.ok(dom.html().includes(extraStrings[lang].localAiNote),'local data handling and experimental status are visible');
  assert.ok(!dom.html().includes(extraStrings[lang].aiNote),'cloud data handling notice is not shown for Ollama');
  assert.equal(dom.select('#chat-input').disabled,false,'local tutor needs no OpenAI key');
  for(const code of ['AI_LOCAL_UNAVAILABLE','AI_LOCAL_MODEL_MISSING','AI_LOCAL_BUSY','AI_LOCAL_INCOMPLETE','AI_LOCAL_SAFETY_UNAVAILABLE','AI_INVALID_RESPONSE','AI_TIMEOUT']){
   failure=code;await ask();
   assert.ok(dom.html().includes(extraStrings[lang][aiErrorKeys[code]]),`${lang}: ${code}`);
   assert.ok(!dom.html().includes('PRIVATE provider response'));
   assert.ok(dom.findButton('logout'),'local model errors keep the account signed in');
  }
 }
 failure=null;await ask();assert.ok(dom.html().includes('A local answer.'));
});
