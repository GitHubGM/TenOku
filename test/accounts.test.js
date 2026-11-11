import test from 'node:test';
import assert from 'node:assert/strict';
import {accountStrings,renderAuth,renderAdmin,renderTeacher,renderAssignments} from '../src/accounts.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t=key=>accountStrings.en[key]||key;
const loc=value=>typeof value==='string'?value:value.en;
test('account pages escape untrusted profile, error and assignment fields',()=>{
 const injected='<img src=x onerror=alert(1)>',user={id:'x" onclick="alert(1)',name:injected,email:injected,role:'student'};
 const pages=[renderAuth({t,esc,error:injected}),renderAdmin({t,esc,users:[user]}),renderTeacher({t,esc,students:[user],lessons:[],loc}),renderAssignments({t,esc,assignments:[{lessonId:'x'}],lessons:[{id:'x',title:{en:injected}}],loc})];
 for(const html of pages){assert.ok(!html.includes(injected));assert.ok(!html.includes(' onclick="alert'));assert.ok(html.includes('&lt;img')||html.includes('&quot;'))}
});
test('registration is student-only with explicit password autocomplete and disabled pending forms',()=>{
 const html=renderAuth({t,esc,mode:'register',busy:true});
 assert.match(html,/autocomplete="new-password"/);assert.match(html,/<fieldset disabled>/);assert.ok(!html.includes('name="role"'));assert.match(html,/Registration creates a student account/);
});
test('account translations cover every supported language',()=>{
 for(const lang of ['kk','ru','en']){assert.deepEqual(Object.keys(accountStrings[lang]),Object.keys(accountStrings.en));assert.ok(Object.values(accountStrings[lang]).every(value=>typeof value==='string'&&value.length))}
});
