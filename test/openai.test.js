import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createOpenAIClient,OpenAIError} from '../backend/openai.mjs';
import {createApp} from '../server.mjs';

const key='test-only-secret-key';
const privatePrompt='private student prompt sentinel';
const jsonResponse=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json',...headers}});
const safeModeration=()=>jsonResponse({results:[{flagged:false}]});
const safeAnswer=()=>jsonResponse({output:[{type:'message',content:[{type:'output_text',text:'Try solving one step at a time.'}]}]});

async function expectError(client,code,appStatus){
  await assert.rejects(client('responses',{input:privatePrompt}),error=>{
    assert.ok(error instanceof OpenAIError);
    assert.equal(error.code,code);
    assert.equal(error.appStatus,appStatus);
    assert.ok(!error.message.includes(key));
    assert.ok(!error.message.includes(privatePrompt));
    return true;
  });
}

test('OpenAI helper maps provider statuses to distinct application errors',async()=>{
  const cases=[
    [401,{code:'invalid_api_key'},'AI_AUTH_FAILED',502],
    [429,{code:'insufficient_quota'},'AI_QUOTA_EXCEEDED',503],
    [429,{type:'insufficient_quota'},'AI_QUOTA_EXCEEDED',503],
    [429,{code:'credit_balance_exhausted'},'AI_QUOTA_EXCEEDED',503],
    [429,{code:'organization_spend_limit_exceeded'},'AI_QUOTA_EXCEEDED',503],
    [429,{code:'project_spend_limit_exceeded'},'AI_QUOTA_EXCEEDED',503],
    [429,{code:'organization_usage_limit_exceeded'},'AI_QUOTA_EXCEEDED',503],
    [429,{code:'billing_hard_limit_reached'},'AI_QUOTA_EXCEEDED',503],
    [429,{code:'rate_limit_exceeded'},'AI_RATE_LIMITED',503],
    [403,{code:'permission_denied'},'AI_ACCESS_DENIED',502],
    [404,{code:'unknown'},'AI_MODEL_UNAVAILABLE',502],
    [400,{code:'model_not_found'},'AI_MODEL_UNAVAILABLE',502],
    [400,{code:'invalid_request_error'},'AI_BAD_REQUEST',502],
    [500,{code:'server_error'},'AI_UNAVAILABLE',502],
    [503,{code:'server_error'},'AI_UNAVAILABLE',502]
  ];
  for(const [status,error,code,appStatus] of cases){
    const client=createOpenAIClient({apiKey:key,logger:()=>{},fetchImpl:async()=>jsonResponse({error:{...error,message:`Do not log ${key} or ${privatePrompt}`}},status)});
    await expectError(client,code,appStatus);
  }
});

test('OpenAI helper sends fixed API URLs, server authorization and caller JSON',async()=>{
  const captured=[];
  const client=createOpenAIClient({apiKey:key,logger:()=>{},fetchImpl:async(url,options)=>{captured.push({url,options});return jsonResponse({id:'response_1'})}});
  const payload={model:'gpt-4.1-mini',input:privatePrompt,store:false};
  assert.deepEqual(await client('responses',payload),{id:'response_1'});
  assert.deepEqual(await client('moderations',{model:'omni-moderation-latest',input:'math'}),{id:'response_1'});
  assert.equal(captured[0].url,'https://api.openai.com/v1/responses');
  assert.equal(captured[1].url,'https://api.openai.com/v1/moderations');
  assert.equal(captured[0].options.method,'POST');
  assert.equal(new Headers(captured[0].options.headers).get('authorization'),`Bearer ${key}`);
  assert.deepEqual(JSON.parse(captured[0].options.body),payload);
  assert.ok(captured[0].options.signal instanceof AbortSignal);
});

test('OpenAI helper rejects unsupported endpoints without a network request',async()=>{
  let calls=0;
  const client=createOpenAIClient({apiKey:key,logger:()=>{},fetchImpl:async()=>{calls++;return jsonResponse({})}});
  for(const path of ['https://untrusted.example','/responses','files','responses/../files'])await assert.rejects(async()=>client(path,{}));
  assert.equal(calls,0);
});

test('OpenAI helper rejects missing keys and invalid JSON response shapes',async()=>{
  let calls=0;
  const missing=createOpenAIClient({apiKey:' ',logger:()=>{},fetchImpl:async()=>{calls++;return jsonResponse({})}});
  await expectError(missing,'AI_NOT_CONFIGURED',503);
  assert.equal(calls,0);
  for(const data of [null,[],42,'text']){
    const client=createOpenAIClient({apiKey:key,logger:()=>{},fetchImpl:async()=>jsonResponse(data)});
    await expectError(client,'AI_INVALID_RESPONSE',502);
  }
  const malformed=createOpenAIClient({apiKey:key,logger:()=>{},fetchImpl:async()=>new Response('{bad json',{status:200})});
  await expectError(malformed,'AI_INVALID_RESPONSE',502);
});

test('OpenAI helper logs only allowlisted diagnostic fields without private material',async()=>{
  const logs=[];
  const client=createOpenAIClient({apiKey:key,logger:entry=>logs.push(entry),fetchImpl:async()=>jsonResponse({error:{code:'INVALID_PRIVATE_PROVIDER_CODE',message:`${key} ${privatePrompt}`,details:{payload:privatePrompt}}},400,{'x-request-id':'req_safe123'})});
  await expectError(client,'AI_BAD_REQUEST',502);
  assert.ok(logs.length);
  const allowed=new Set(['endpoint','status','category','providerCode','requestId','networkCode']);
  for(const log of logs){assert.equal(typeof log,'object');assert.ok(Object.keys(log).every(k=>allowed.has(k)),JSON.stringify(log))}
  const output=JSON.stringify(logs);
  for(const secret of [key,privatePrompt,'INVALID_PRIVATE_PROVIDER_CODE','payload'])assert.ok(!output.includes(secret),output);
  assert.ok(output.includes('req_safe123'));
});

test('OpenAI diagnostic whitelist preserves known codes and drops arbitrary request IDs',async()=>{
  const logs=[];
  const client=createOpenAIClient({apiKey:key,logger:entry=>logs.push(entry),fetchImpl:async()=>jsonResponse({error:{code:'invalid_api_key',message:key}},401,{'x-request-id':'private arbitrary request id'})});
  await expectError(client,'AI_AUTH_FAILED',502);
  assert.deepEqual(logs,[{endpoint:'responses',category:'AI_AUTH_FAILED',status:401,providerCode:'invalid_api_key'}]);
});

test('a failing diagnostic logger does not replace the safe provider error',async()=>{
  const client=createOpenAIClient({apiKey:key,logger:()=>{throw new Error(`logger failed ${key}`)},fetchImpl:async()=>jsonResponse({error:{code:'insufficient_quota'}},429)});
  await expectError(client,'AI_QUOTA_EXCEEDED',503);
});

test('OpenAI helper classifies network failures without leaking exception messages',async()=>{
  const logs=[];
  const cause=Object.assign(new Error(`private network detail ${key}`),{code:'ECONNREFUSED'});
  const client=createOpenAIClient({apiKey:key,logger:entry=>logs.push(entry),fetchImpl:async()=>{throw new TypeError(`fetch failed ${privatePrompt}`,{cause})}});
  await expectError(client,'AI_CONNECTION_FAILED',502);
  const output=JSON.stringify(logs);
  assert.ok(!output.includes(key));assert.ok(!output.includes(privatePrompt));assert.ok(!output.includes('private network detail'));
});

async function bounded(promise){
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Request timeout did not terminate operation')),1500)})])}
  finally{clearTimeout(timer)}
}
test('OpenAI timeout bounds fetch even when a transport ignores abort',async()=>{
  const client=createOpenAIClient({apiKey:key,logger:()=>{},timeoutMs:20,fetchImpl:()=>new Promise(()=>{})});
  await bounded(expectError(client,'AI_TIMEOUT',504));
});
test('OpenAI timeout also bounds response JSON parsing',async()=>{
  const client=createOpenAIClient({apiKey:key,logger:()=>{},timeoutMs:20,fetchImpl:async()=>({ok:true,status:200,headers:new Headers(),json:()=>new Promise(()=>{})})});
  await bounded(expectError(client,'AI_TIMEOUT',504));
});

async function apiFixture(t,{fetchImpl,env={}}={}){
  const app=createApp({dbPath:':memory:',env:{APP_ORIGIN:'http://localhost:3000',OPENAI_API_KEY:key,...env},fetchImpl});
  t.after(()=>app.close());
  async function request(path,{method='GET',body,user}={}){
    const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
    Object.assign(req,{url:path,method,headers:{host:'localhost:3000',origin:'http://localhost:3000','content-type':'application/json',...(user?{cookie:user.cookie,'x-csrf-token':user.csrfToken}:{})},socket:{remoteAddress:'127.0.0.1'}});
    const headers={};let status,text;
    const res={statusCode:200,writeHead(code,values){status=code;this.statusCode=code;for(const [name,value] of Object.entries(values||{}))headers[name.toLowerCase()]=value;return this},setHeader(name,value){headers[name.toLowerCase()]=value},end(data){text=String(data??'');return this}};
    await app(req,res);
    return {status,text,json:JSON.parse(text),headers};
  }
  async function student(){const result=await request('/api/auth/register',{method:'POST',body:{name:'Test Student',email:'student@example.com',password:'Student-pass123!'}});assert.equal(result.status,200,result.text);const cookie=result.headers['set-cookie'];return {...result.json,cookie:(Array.isArray(cookie)?cookie[0]:cookie).split(';')[0]}}
  return {request,student};
}

test('chat endpoint surfaces moderation authentication failures safely',async t=>{
  const urls=[];
  const {request,student}=await apiFixture(t,{fetchImpl:async url=>{urls.push(url);return jsonResponse({error:{code:'invalid_api_key',message:`secret ${key}`}},401)}});
  const user=await student();
  const result=await request('/api/chat',{method:'POST',user,body:{message:'Help with equations',lang:'en',history:[]}});
  assert.equal(result.status,502);assert.equal(result.json.code,'AI_AUTH_FAILED');
  assert.ok(!result.text.includes(key));
  assert.deepEqual(urls,['https://api.openai.com/v1/moderations']);
});

test('chat endpoint surfaces Responses quota errors separately from request-rate errors',async t=>{
  let code='insufficient_quota';
  const {request,student}=await apiFixture(t,{fetchImpl:async url=>url.endsWith('/moderations')?safeModeration():jsonResponse({error:{code,message:`private ${key}`}},429)});
  const user=await student(),body={message:'Help with equations',history:[],lang:'en'};
  const quota=await request('/api/chat',{method:'POST',user,body});
  assert.equal(quota.status,503);assert.equal(quota.json.code,'AI_QUOTA_EXCEEDED');
  code='rate_limit_exceeded';
  const rate=await request('/api/chat',{method:'POST',user,body});
  assert.equal(rate.status,503);assert.equal(rate.json.code,'AI_RATE_LIMITED');
  assert.ok(!quota.text.includes(key));assert.ok(!rate.text.includes(key));
});

test('chat endpoint trims configured key and model before provider calls',async t=>{
  let outbound;
  const {request,student}=await apiFixture(t,{env:{OPENAI_API_KEY:`  ${key}  `,OPENAI_MODEL:'  gpt-4.1-mini  '},fetchImpl:async(url,options)=>{
    assert.equal(new Headers(options.headers).get('authorization'),`Bearer ${key}`);
    if(url.endsWith('/moderations'))return safeModeration();
    outbound=JSON.parse(options.body);return safeAnswer();
  }});
  const user=await student();
  const result=await request('/api/chat',{method:'POST',user,body:{message:'Explain percentages',history:[],lang:'en'}});
  assert.equal(result.status,200,result.text);
  assert.equal(outbound.model,'gpt-4.1-mini');
  assert.equal(result.json.reply,'Try solving one step at a time.');
});

test('whitespace-only configured key leaves AI disabled',async t=>{
  let calls=0;
  const {request,student}=await apiFixture(t,{env:{OPENAI_API_KEY:'   '},fetchImpl:async()=>{calls++;return safeModeration()}});
  assert.equal((await request('/api/session')).json.aiEnabled,false);
  const user=await student();
  const result=await request('/api/chat',{method:'POST',user,body:{message:'Explain percentages',history:[],lang:'en'}});
  assert.equal(result.status,503);assert.equal(result.json.code,'AI_NOT_CONFIGURED');
  assert.equal(calls,0);
});

