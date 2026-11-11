import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('focus outline applies only to keyboard-focused controls',()=>{
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 const outlineRules=[...css.matchAll(/([^{}]+)\{([^{}]*outline\s*:[^{}]*)\}/g)];
 const focusRule=outlineRules.find(([,selector,body])=>body.includes('#75d9ff'));
 assert.ok(focusRule,'Keyboard focus stays visible');
 assert.ok(focusRule[1].split(',').every(selector=>selector.trim().endsWith(':focus-visible')),'An outline must not target every button or link');
});
