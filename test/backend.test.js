import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
import {questions, lessons} from '../src/content.js';

const origin = 'http://localhost:3000';
const adminCredentials = {email:'admin@example.com',password:'Admin-pass123!'};
const password = 'Student-pass123!';

async function fixture(t, overrides={}) {
  const app = await createApp({dbPath:':memory:',...overrides,env:{APP_ORIGIN:origin,ADMIN_EMAIL:adminCredentials.email,ADMIN_PASSWORD:adminCredentials.password,OPENAI_API_KEY:'test-only-secret',...overrides.env}});
  let closed=false;
  async function close(){if(!closed){closed=true;await app.close()}}
  t.after(close);
  async function request(path, {method='GET',body,user,headers={},remoteAddress='127.0.0.1'}={}) {
    const content = body === undefined ? '' : JSON.stringify(body);
    const req = Readable.from(content ? [Buffer.from(content)] : []);
    Object.assign(req, {url:path,method,headers:{host:'localhost:3000',...(method!=='GET'?{origin,'content-type':'application/json'}:{}),...(user?{cookie:user.cookie,'x-csrf-token':user.csrfToken}:{}),...headers},socket:{remoteAddress}});
    const responseHeaders = {};
    let status=200, result='';
    const res = {
      statusCode:200, headersSent:false,
      setHeader(name,value){responseHeaders[name.toLowerCase()]=value;return this},
      getHeader(name){return responseHeaders[name.toLowerCase()]},
      writeHead(code,reason,more){status=code;this.statusCode=code;this.headersSent=true;const values=typeof reason==='object'?reason:more;for(const [name,value] of Object.entries(values||{}))this.setHeader(name,value);return this},
      end(data){status=this.statusCode;result=data===undefined?'':String(data);this.writableEnded=true;return this},
      write(data){result+=String(data);return true}
    };
    await app(req,res);
    let json; try{json=JSON.parse(result)}catch{}
    return {status,headers:responseHeaders,text:result,json};
  }
  async function login(credentials=adminCredentials) {
    const response = await request('/api/auth/login',{method:'POST',body:credentials});
    assert.equal(response.status,200,response.text);
    assert.ok(response.json.user?.id,response.text);
    assert.ok(response.json.csrfToken,response.text);
    const cookies = response.headers['set-cookie'];
    assert.ok(cookies,'Login must set a session cookie');
    return {...response.json,cookie:(Array.isArray(cookies)?cookies[0]:cookies).split(';')[0],setCookie:cookies};
  }
  async function register(email='student@example.com',name='Student') {
    const response=await request('/api/auth/register',{method:'POST',body:{email,password,name}});
    assert.ok([200,201].includes(response.status),response.text);
    assert.equal(response.json.user.role,'student');
    const cookies=response.headers['set-cookie'];
    return {...response.json,cookie:(Array.isArray(cookies)?cookies[0]:cookies).split(';')[0]};
  }
  return {app,request,login,register,close};
}

test('authentication protects sessions, validates origin and CSRF, and clears logout',async t=>{
  const {request,register,login}=await fixture(t);
  assert.equal((await request('/api/progress')).status,401);
  const initial=await request('/api/session');
  assert.equal(initial.json.user,null);
  assert.equal(initial.json.csrfToken,null);
  const rejected=await request('/api/auth/login',{method:'POST',body:adminCredentials,headers:{origin:'https://untrusted.example'}});
  assert.equal(rejected.status,403);
  const student=await register();
  assert.equal((await request('/api/session',{user:student})).json.user.email,'student@example.com');
  const admin=await login();
  assert.match(String(admin.setCookie),/HttpOnly/i);
  assert.match(String(admin.setCookie),/SameSite=/i);
  assert.ok(!String(admin.setCookie).includes(adminCredentials.password));
  const missingCsrf=await request('/api/profile',{method:'PATCH',body:{name:'New name'},headers:{cookie:student.cookie}});
  assert.equal(missingCsrf.status,403);
  const wrongCsrf=await request('/api/profile',{method:'PATCH',body:{name:'New name'},user:student,headers:{'x-csrf-token':'wrong'}});
  assert.equal(wrongCsrf.status,403);
  assert.equal((await request('/api/profile',{method:'PATCH',body:{name:'New name'},user:student})).status,200);
  assert.equal((await request('/api/auth/logout',{method:'POST',body:{},user:student})).status,200);
  assert.equal((await request('/api/progress',{user:student})).status,401);
  const wrongPassword=await request('/api/auth/login',{method:'POST',body:{email:adminCredentials.email,password:'Incorrect-pass123!'}});
  assert.equal(wrongPassword.status,401);
});

test('server owns grading and keeps individual progress isolated',async t=>{
  const {request,register}=await fixture(t);
  const a=await register('alice@example.com','Alice');
  const b=await register('bob@example.com','Bob');
  const selected=questions.filter(q=>q.subject==='math');
  const result=await request('/api/attempts',{method:'POST',user:a,body:{subject:'math',questionIds:selected.map(q=>q.id),answers:selected.map(q=>q.answer),score:999}});
  assert.ok([200,201].includes(result.status),result.text);
  assert.equal(result.json.attempt.score,selected.length);
  assert.equal(result.json.attempt.total,selected.length);
  assert.equal(result.json.progress.attempts.length,1);
  await request('/api/progress/complete',{method:'POST',user:a,body:{lessonId:lessons[0].id}});
  await request('/api/progress/complete',{method:'POST',user:a,body:{lessonId:lessons[0].id}});
  await request('/api/progress/plan',{method:'PUT',user:a,body:{plan:[lessons[0].id]}});
  const progress=(await request('/api/progress',{user:a})).json;
  assert.deepEqual(progress.completed,[lessons[0].id]);
  assert.deepEqual(progress.plan,[lessons[0].id]);
  const untouched=(await request('/api/progress',{user:b})).json;
  assert.deepEqual(untouched.completed,[]);
  assert.deepEqual(untouched.attempts,[]);
  const invalid=await request('/api/attempts',{method:'POST',user:a,body:{subject:'math',questionIds:['not-a-question'],answers:[0]}});
  assert.equal(invalid.status,400);
  const duplicate=await request('/api/attempts',{method:'POST',user:a,body:{subject:'math',questionIds:[selected[0].id,selected[0].id],answers:[0,0]}});
  assert.equal(duplicate.status,400);
});

test('admin role changes and account disabling are enforced on the server',async t=>{
  const {request,register,login}=await fixture(t);
  const admin=await login();
  const student=await register();
  assert.equal((await request('/api/admin/users',{user:student})).status,403);
  assert.equal((await request('/api/admin/users',{method:'POST',user:student,body:{name:'Admin',email:'intruder@example.com',password,role:'admin'}})).status,403);
  assert.ok([400,409].includes((await request(`/api/admin/users/${admin.user.id}`,{method:'PATCH',user:admin,body:{role:'student'}})).status));
  assert.ok([400,409].includes((await request(`/api/admin/users/${admin.user.id}`,{method:'PATCH',user:admin,body:{disabled:true}})).status));
  const listing=await request('/api/admin/users',{user:admin});
  assert.equal(listing.status,200);
  assert.ok(listing.json.users.some(u=>u.id===student.user.id));
  assert.ok(!/password_hash|passwordHash|test-only-secret/.test(listing.text));
  const disabled=await request(`/api/admin/users/${student.user.id}`,{method:'PATCH',user:admin,body:{disabled:true}});
  assert.equal(disabled.status,200,disabled.text);
  assert.equal((await request('/api/progress',{user:student})).status,401);
});

test('teachers only see assigned students and assign lessons within their roster',async t=>{
  const {request,register,login}=await fixture(t);
  const admin=await login();
  const alice=await register('alice@example.com','Alice');
  const bob=await register('bob@example.com','Bob');
  const created=await request('/api/admin/users',{method:'POST',user:admin,body:{name:'Teacher',email:'teacher@example.com',password,role:'teacher'}});
  assert.ok([200,201].includes(created.status),created.text);
  const teacher=await login({email:'teacher@example.com',password});
  assert.equal((await request('/api/teacher/students',{user:alice})).status,403);
  assert.equal((await request('/api/admin/assignments',{method:'PUT',user:admin,body:{teacherId:teacher.user.id,studentIds:[alice.user.id]}})).status,200);
  const roster=(await request('/api/teacher/students',{user:teacher})).json.students;
  assert.equal(roster.length,1);
  assert.equal(roster[0].id,alice.user.id);
  const denied=await request('/api/teacher/assignments',{method:'POST',user:teacher,body:{studentId:bob.user.id,lessonId:lessons[0].id}});
  assert.equal(denied.status,403);
  const assignment=await request('/api/teacher/assignments',{method:'POST',user:teacher,body:{studentId:alice.user.id,lessonId:lessons[0].id}});
  assert.ok([200,201].includes(assignment.status),assignment.text);
  assert.equal((await request('/api/assignments',{user:alice})).json.assignments.length,1);
  assert.equal((await request('/api/assignments',{user:bob})).json.assignments.length,0);
});

test('AI calls keep secrets server-side and constrain provider requests',async t=>{
  let outbound;
  const fetchImpl=async(url,options)=>{
    if(url.endsWith('/moderations'))return new Response(JSON.stringify({results:[{flagged:false}]}),{status:200,headers:{'content-type':'application/json'}});
    outbound={url,options,body:JSON.parse(options.body)};
    return new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'Let us solve this step by step.'}]}]}),{status:200,headers:{'content-type':'application/json'}});
  };
  const {request,register}=await fixture(t,{fetchImpl});
  const student=await register();
  assert.equal((await request('/api/chat',{method:'POST',body:{message:'Hello',lang:'en',history:[]}})).status,401);
  const response=await request('/api/chat',{method:'POST',user:student,body:{message:'Explain equations',lang:'en',history:[]}});
  assert.equal(response.status,200,response.text);
  assert.equal(response.json.reply,'Let us solve this step by step.');
  assert.equal(outbound.url,'https://api.openai.com/v1/responses');
  assert.equal(outbound.body.store,false);
  assert.ok(outbound.body.max_output_tokens<=1000);
  assert.ok(outbound.body.safety_identifier);
  assert.ok(!response.text.includes('test-only-secret'));
  assert.ok(!(await request('/api/session',{user:student})).text.includes('test-only-secret'));
});

test('AI upstream failures are sanitized',async t=>{
  const fetchImpl=async()=>new Response(JSON.stringify({error:{message:'debug test-only-secret provider details'}}),{status:500,headers:{'content-type':'application/json'}});
  const {request,register}=await fixture(t,{fetchImpl});
  const student=await register();
  const response=await request('/api/chat',{method:'POST',user:student,body:{message:'Help with math',history:[],lang:'en'}});
  assert.ok(response.status>=400);
  assert.ok(!response.text.includes('test-only-secret'));
  assert.ok(!response.text.includes('provider details'));
});

test('AI refuses moderated input before calling the response model',async t=>{
  const urls=[];
  const fetchImpl=async url=>{urls.push(url);return new Response(JSON.stringify({results:[{flagged:true}]}),{status:200,headers:{'content-type':'application/json'}})};
  const {request,register}=await fixture(t,{fetchImpl});
  const student=await register();
  const response=await request('/api/chat',{method:'POST',user:student,body:{message:'Moderation test',history:[],lang:'en'}});
  assert.equal(response.status,200,response.text);
  assert.match(response.json.reply,/safe way/);
  assert.equal(urls.length,1);
  assert.ok(urls[0].endsWith('/moderations'));
});

test('AI withholds flagged generated output',async t=>{
  let moderationCalls=0;
  const fetchImpl=async url=>{
    if(url.endsWith('/moderations'))return new Response(JSON.stringify({results:[{flagged:++moderationCalls===2}]}),{status:200});
    return new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'flagged model output sentinel'}]}]}),{status:200});
  };
  const {request,register}=await fixture(t,{fetchImpl});
  const student=await register();
  const response=await request('/api/chat',{method:'POST',user:student,body:{message:'Explain equations',history:[],lang:'en'}});
  assert.equal(response.status,200,response.text);
  assert.equal(moderationCalls,2);
  assert.ok(!response.text.includes('flagged model output sentinel'));
});

test('AI fails closed when moderation service is unavailable',async t=>{
  const urls=[];
  const fetchImpl=async url=>{urls.push(url);throw new Error('secret provider failure')};
  const {request,register}=await fixture(t,{fetchImpl});
  const student=await register();
  const response=await request('/api/chat',{method:'POST',user:student,body:{message:'Explain equations',history:[],lang:'en'}});
  assert.ok(response.status>=400);
  assert.ok(!response.text.includes('secret provider failure'));
  assert.equal(urls.length,1);
  assert.ok(urls[0].endsWith('/moderations'));
});

test('accounts, sessions and isolated progress survive reopening the database',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'tenbilim-backend-test-'));
  let first,second;
  t.after(async()=>{await first?.close();await second?.close();await rm(dir,{recursive:true,force:true})});
  const dbPath=join(dir,'app.sqlite');
  first=await fixture(t,{dbPath});
  const alice=await first.register('persistent-alice@example.com','Alice');
  const bob=await first.register('persistent-bob@example.com','Bob');
  await first.request('/api/progress/complete',{method:'POST',user:alice,body:{lessonId:lessons[0].id}});
  await first.request('/api/progress/plan',{method:'PUT',user:alice,body:{plan:[lessons[1].id]}});
  await first.close();
  second=await fixture(t,{dbPath});
  const restored=(await second.request('/api/progress',{user:alice})).json;
  assert.deepEqual(restored.completed,[lessons[0].id]);
  assert.deepEqual(restored.plan,[lessons[1].id]);
  assert.deepEqual((await second.request('/api/progress',{user:bob})).json.completed,[]);
  const loggedIn=await second.login({email:'persistent-alice@example.com',password});
  assert.equal(loggedIn.user.id,alice.user.id);
});

test('static server never publishes environment files, database or backend sources',async t=>{
  const {request}=await fixture(t);
  for(const path of ['/.env','/data/app.sqlite','/backend/app.mjs','/server.mjs','/package.json','/../.env','/%2e%2e/.env']){
    assert.equal((await request(path)).status,404,path);
  }
  const index=await request('/');
  assert.equal(index.status,200);
  assert.match(index.headers['content-security-policy'],/default-src 'self'/);
  assert.match(index.text,/<!doctype html>/i);
});

test('secure cookie configuration marks session cookies Secure',async t=>{
  const {login}=await fixture(t,{env:{COOKIE_SECURE:'true'}});
  const admin=await login();
  assert.match(String(admin.setCookie),/; Secure/);
});

test('untrusted forwarded headers cannot bypass registration rate limits',async t=>{
  const {request}=await fixture(t);
  for(let i=0;i<61;i++){
    const response=await request('/api/auth/register',{method:'POST',body:{name:'',email:'rate@example.com',password},headers:{'x-forwarded-for':`198.51.100.${i+1}`}});
    assert.equal(response.status,i===60?429:400,response.text);
  }
});

test('trusted proxy uses normalized peer IP and the rightmost valid forwarded client',async t=>{
  const {request}=await fixture(t,{env:{TRUSTED_PROXY_IPS:'127.0.0.1'}});
  for(let i=0;i<61;i++){
    const response=await request('/api/auth/register',{method:'POST',remoteAddress:'::ffff:127.0.0.1',body:{name:'',email:'rate@example.com',password},headers:{'x-forwarded-for':`198.51.100.${i+1}`}});
    assert.equal(response.status,400,response.text);
  }
  for(let i=0;i<61;i++){
    const response=await request('/api/auth/register',{method:'POST',body:{name:'',email:'rate@example.com',password},headers:{'x-forwarded-for':`198.51.100.${i+20}, 203.0.113.1`}});
    assert.equal(response.status,i===60?429:400,response.text);
  }
});

test('daily AI limit survives database reopening and resets at UTC midnight',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'tenbilim-ai-quota-test-'));
  let first,second,now=Date.UTC(2026,10,11,23,59,50),modelCalls=0;
  t.after(async()=>{await first?.close();await second?.close();await rm(dir,{recursive:true,force:true})});
  const fetchImpl=async url=>{
    if(url.endsWith('/moderations'))return new Response(JSON.stringify({results:[{flagged:false}]}),{status:200});
    modelCalls++;
    return new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'Practice one step at a time.'}]}]}),{status:200});
  };
  const options={dbPath:join(dir,'app.sqlite'),clock:()=>now,env:{AI_DAILY_LIMIT:'1'},fetchImpl};
  first=await fixture(t,options);
  const student=await first.register();
  const request={method:'POST',user:student,body:{message:'Help with equations',history:[],lang:'en'}};
  assert.equal((await first.request('/api/chat',request)).status,200);
  await first.close();
  second=await fixture(t,options);
  assert.equal((await second.request('/api/chat',request)).status,429);
  assert.equal(modelCalls,1);
  now=Date.UTC(2026,10,12,0,0,1);
  assert.equal((await second.request('/api/chat',request)).status,200);
  assert.equal(modelCalls,2);
});
