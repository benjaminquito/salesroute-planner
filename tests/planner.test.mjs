import test from 'node:test';
import assert from 'node:assert/strict';
import { planVisits } from '../src/planner.mjs';
const salesperson = (id, startLocation) => ({ id, startLocation, shiftStart: 0, shiftEnd: 100 });
const customer = (id, location, extra = {}) => ({ id, location, serviceMinutes: 10, ...extra });
const times = (a, b) => Math.abs(a.x - b.x);
test('multiple starts assign customers once and finish at last customer', () => {
 const p = planVisits({ salespeople: [salesperson('A', {x:0}), salesperson('B', {x:100})], customers: [customer('C', {x:5}), customer('D', {x:95})], travelMinutes: times });
 assert.deepEqual(p.routes.map(r=>r.stops.map(s=>s.customerId)), [['C'],['D']]);
 assert.equal(p.totalTravelMinutes,10); assert(p.routes.every(r=>r.finish===15 && !r.returnsToStart)); assert.equal(p.status,'draft');
});
test('waits for appointments and checks full service against windows', () => {
 const p=planVisits({salespeople:[salesperson('A',{x:0})],customers:[customer('C',{x:5},{window:{start:20,end:30}}),customer('D',{x:8},{window:{start:0,end:9}})],travelMinutes:times});
 assert.equal(p.routes[0].stops[0].waitingMinutes,15); assert.equal(p.routes[0].finish,30); assert.equal(p.unassigned[0].customerId,'D');
});
test('respects fixed assignment, capacity and shift end', () => {
 const p=planVisits({salespeople:[{...salesperson('A',{x:0}),maxVisits:0},{...salesperson('B',{x:20}),shiftEnd:35}],customers:[customer('C',{x:0},{salespersonId:'B'}),customer('D',{x:20})],travelMinutes:times});
 assert.equal(p.routes[0].stops.length,0); assert.equal(p.routes[1].stops.length,1); assert.equal(p.unassigned.length,1);
});
test('accepts asymmetric travel and never requests a return leg', () => {
 const calls=[]; const p=planVisits({salespeople:[salesperson('A','home')],customers:[customer('C','customer')],travelMinutes:(a,b)=>{calls.push([a,b]);return 7;}});
 assert.equal(p.totalTravelMinutes,7); assert(calls.every(([a,b])=>a==='home' && b==='customer'));
});
test('unreachable visits and no salespeople produce explicit unassigned results',()=>{
 for(const salespeople of [[],[salesperson('A','home')]]){const p=planVisits({salespeople,customers:[customer('C','place')],travelMinutes:()=>Infinity});assert.equal(p.unassigned.length,1);}
});
test('rejects duplicate IDs and invalid travel times',()=>{
 assert.throws(()=>planVisits({salespeople:[],customers:[customer('C','x'),customer('C','y')],travelMinutes:times}),/duplicate/);
 assert.throws(()=>planVisits({salespeople:[salesperson('A','home')],customers:[customer('C','place')],travelMinutes:()=>NaN}),/travel time/);
});
