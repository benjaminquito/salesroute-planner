import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import { emptyWorkspace, validateWorkspace, createPlan } from '../src/application.mjs';
const fixture = () => ({ ...emptyWorkspace(), salespeople:[{id:'S1',name:'Fictional Rep',address:'Example start',startLocation:{lat:43,lon:-80},shiftStart:540,shiftEnd:1020,maxVisits:5}],customers:[{id:'C1',name:'Fictional Customer',address:'Example destination',location:{lat:43.01,lon:-80},serviceMinutes:30}] });
test('estimates are labelled and supplied times are directional, with missing legs unreachable', () => {
  const w=fixture(); assert.match(createPlan(w).travelLabel,/TEST ESTIMATE/);
  w.travelMode='supplied'; assert.equal(createPlan(w).unassigned.length,1);
  w.travelTimes=[{from:'S1',to:'C1',minutes:12}]; assert.equal(createPlan(w).routes[0].finish,582);
  w.travelTimes[0].minutes=null; assert.equal(createPlan(w).unassigned.length,1);
});
test('validates coordinates, fixed assignments, working times and import limits', () => {
  for (const mutate of [w=>w.customers[0].location.lat=91,w=>w.customers[0].salespersonId='missing',w=>w.salespeople[0].shiftEnd=500,w=>w.customers[0].serviceMinutes=0,w=>w.travelTimes=[{from:'missing',to:'C1',minutes:3}],w=>w.speedKmh=0,w=>w.customers[0].id='S1']) {
    const w=fixture();mutate(w);assert.throws(()=>validateWorkspace(w));
  }
});
test('local server persists data, rejects stale saves and cross-origin writes, clears stale plans, and restarts', async () => {
  const dir=mkdtempSync(join(tmpdir(),'salesroute-test-'));
  let child;
  async function start() {
    child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',SALESROUTE_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
    let output='';
    const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timed out')),5000);child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited'));});});
    return url;
  }
  async function stop(){ const done=once(child,'exit');child.kill();await done; }
  try {
    let url=await start();
    const request=(path,body,headers={})=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
    let response=await request('/api/workspace',{revision:0,workspace:fixture()});assert.equal(response.status,200);
    assert.equal((await request('/api/workspace',{revision:0,workspace:fixture()})).status,409);
    assert.equal((await request('/api/workspace',{revision:1,workspace:fixture()},{Origin:'https://example.com'})).status,403);
    const badHost = await new Promise((resolve, reject) => { const req = http.get(url+'/api/workspace', {headers:{Host:'evil.test'}}, res => {res.resume(); resolve(res.statusCode);}); req.on('error',reject); });
    assert.equal(badHost,403);
    response=await request('/api/plan',{revision:1});const planned=await response.json();assert.equal(planned.plan.routes[0].stops.length,1);
    response=await request('/api/workspace',{revision:2,workspace:fixture()});assert.equal((await response.json()).plan,null);
    assert.equal(JSON.parse(readFileSync(join(dir,'workspace.json.previous'),'utf8')).revision,2);
    await stop();url=await start();const restored=await (await fetch(url+'/api/workspace')).json();assert.equal(restored.revision,3);assert.equal(restored.workspace.customers.length,1);
    const html=await fetch(url+'/');assert.match(html.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(await html.text(),/SalesRoute/);
    assert.equal((await fetch(url+'/server.mjs')).status,404);
  } finally {if(child?.exitCode===null) await stop();rmSync(dir,{recursive:true,force:true});}
});
