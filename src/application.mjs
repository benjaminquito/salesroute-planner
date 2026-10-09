import { planVisits } from './planner.mjs';

const text = (s, label) => { if (typeof s !== 'string' || !s.trim() || s.length > 300) throw Error(`Enter a valid ${label}.`); };
const time = n => Number.isInteger(n) && n >= 0 && n <= 1440;
export const emptyWorkspace = () => ({ customers: [], salespeople: [], travelMode: 'estimate', speedKmh: 40, travelTimes: [] });
export function validateWorkspace(w) {
  if (!w || !Array.isArray(w.customers) || !Array.isArray(w.salespeople) || !Array.isArray(w.travelTimes)) throw Error('Invalid workspace.');
  if (w.customers.length > 100 || w.salespeople.length > 20) throw Error('This prototype supports up to 100 customers and 20 salespeople.');
  if (!['estimate', 'supplied'].includes(w.travelMode) || !Number.isFinite(w.speedKmh) || w.speedKmh < 5 || w.speedKmh > 120) throw Error('Invalid travel settings.');
  const ids = new Set();
  for (const [kind, rows] of [['salesperson', w.salespeople], ['customer', w.customers]]) {
    for (const row of rows) {
      text(row.id, 'ID'); text(row.name, 'name'); text(row.address, 'address');
      if (ids.has(row.id)) throw Error('IDs must be unique across customers and salespeople.');
      ids.add(row.id);
      const p = kind === 'salesperson' ? row.startLocation : row.location;
      if (!p || !Number.isFinite(p.lat) || Math.abs(p.lat) > 90 || !Number.isFinite(p.lon) || Math.abs(p.lon) > 180) throw Error('Enter valid latitude and longitude. Addresses are not automatically located yet.');
      if (kind === 'salesperson') {
        if (!time(row.shiftStart) || !time(row.shiftEnd) || row.shiftEnd <= row.shiftStart || !Number.isInteger(row.maxVisits) || row.maxVisits < 0 || row.maxVisits > 100) throw Error('Check working hours and visit limit.');
      } else {
        if (!Number.isInteger(row.serviceMinutes) || row.serviceMinutes < 1 || row.serviceMinutes > 1440) throw Error('Visit duration must be 1–1440 minutes.');
        if (row.window && (!time(row.window.start) || !time(row.window.end) || row.window.end <= row.window.start)) throw Error('Check the appointment window.');
        if (row.salespersonId && !w.salespeople.some(s => s.id === row.salespersonId)) throw Error('Unknown assigned salesperson.');
      }
    }
  }
  if (w.travelTimes.length > 12000) throw Error('Too many travel-time entries.');
  const legs = new Set();
  for (const leg of w.travelTimes) {
    const key = JSON.stringify([leg.from, leg.to]);
    if (!ids.has(leg.from) || !w.customers.some(c => c.id === leg.to) || legs.has(key) || (leg.minutes !== null && (!Number.isFinite(leg.minutes) || leg.minutes < 0 || leg.minutes > 10080))) throw Error('Invalid or duplicate travel-time entry. Use existing IDs and nonnegative minutes, or null for unreachable.');
    legs.add(key);
  }
  return w;
}
export function createPlan(workspace) {
  const w = validateWorkspace(workspace);
  if (!w.customers.length || !w.salespeople.length) throw Error('Add at least one customer and one salesperson.');
  const travel = new Map(w.travelTimes.map(l => [JSON.stringify([l.from, l.to]), l.minutes === null ? Infinity : l.minutes]));
  const salespeople = w.salespeople.map(s => ({ ...s, startLocation: { ...s.startLocation, id: s.id } }));
  const customers = w.customers.map(c => ({ ...c, location: { ...c.location, id: c.id } }));
  const minutes = (a, b) => {
    if (w.travelMode === 'supplied') return travel.get(JSON.stringify([a.id, b.id])) ?? Infinity;
    const rad = n => n * Math.PI / 180;
    const h = Math.sin(rad(b.lat-a.lat)/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lon-a.lon)/2)**2;
    return Math.ceil(6371 * 2 * Math.asin(Math.sqrt(Math.min(1,h))) / w.speedKmh * 60);
  };
  return { ...planVisits({ salespeople, customers, travelMinutes: minutes }), generatedAt: new Date().toISOString(), travelMode: w.travelMode, travelLabel: w.travelMode === 'estimate' ? `TEST ESTIMATE — straight-line distance at ${w.speedKmh} km/h; not driving directions` : 'Supplied directional travel times; missing legs treated as unreachable' };
}
