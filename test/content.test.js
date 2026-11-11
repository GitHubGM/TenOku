import test from 'node:test';
import assert from 'node:assert/strict';
import {subjects,lessons,questions,grade} from '../src/content.js';
import {translations} from '../src/i18n.js';
test('all content is translated and lesson references exist',()=>{
 const localized=v=>{for(const lang of ['kk','ru','en'])assert.ok(v[lang]?.trim(),`Missing ${lang}`)};
 for(const s of subjects){localized(s.name);localized(s.description)}
 for(const l of lessons){assert.ok(subjects.some(s=>s.id===l.subject));localized(l.title);localized(l.intro);l.steps.forEach(localized)}
 for(const q of questions){localized(q.q);localized(q.why);q.options.filter(v=>typeof v!=='string').forEach(localized);assert.ok(lessons.some(l=>l.id===q.lesson));assert.ok(q.answer>=0&&q.answer<q.options.length)}
 for(const lang of ['kk','ru','en']){assert.deepEqual(Object.keys(translations[lang]),Object.keys(translations.en));assert.ok(Object.values(translations[lang]).every(Boolean))}
});
test('scores correct, incorrect, and incomplete attempts',()=>{
 const ids=questions.map(q=>q.id);assert.equal(grade(ids,questions.map(q=>q.answer)),9);assert.equal(grade(ids,questions.map(q=>(q.answer+1)%4)),0);assert.equal(grade(ids,[]),0);assert.equal(grade(ids,[questions[0].answer]),1);
});
test('content identifiers are unique',()=>{for(const collection of [subjects,lessons,questions])assert.equal(new Set(collection.map(x=>x.id)).size,collection.length)});
