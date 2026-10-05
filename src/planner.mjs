/** Open-route insertion heuristic. Travel times must be supplied in minutes.
 * Routes end at the last customer. This is a feasible proposal, not a proof
 * of optimality. An unreachable leg must be represented by Infinity.
 */
export function planVisits({ salespeople, customers, travelMinutes }) {
  if (!Array.isArray(salespeople) || !Array.isArray(customers) || typeof travelMinutes !== 'function') throw Error('Supply salespeople, customers and a travel-time function.');
  const number = (n, name) => { if (!Number.isFinite(n) || n < 0) throw Error(`Invalid ${name}.`); };
  for (const [rows, label] of [[salespeople, 'salesperson'], [customers, 'customer']]) {
    const ids = new Set();
    for (const r of rows) {
      if (typeof r.id !== 'string' || !r.id.trim() || ids.has(r.id)) throw Error(`Missing or duplicate ${label} ID.`);
      ids.add(r.id);
    }
  }
  for (const s of salespeople) {
    if (!s.startLocation) throw Error('Each salesperson needs a starting location.');
    number(s.shiftStart, 'shift start'); number(s.shiftEnd, 'shift end');
    if (s.shiftEnd < s.shiftStart) throw Error('Shift ends before it starts.');
    if (s.maxVisits !== undefined && (!Number.isInteger(s.maxVisits) || s.maxVisits < 0)) throw Error('Invalid maximum visits.');
  }
  for (const c of customers) {
    if (!c.location) throw Error('Each customer needs a location.');
    number(c.serviceMinutes, 'visit duration');
    if (c.window) {
      number(c.window.start, 'window start'); number(c.window.end, 'window end');
      if (c.window.end < c.window.start) throw Error('Appointment window ends before it starts.');
    }
    if (c.salespersonId && !salespeople.some(s => s.id === c.salespersonId)) throw Error('Unknown assigned salesperson.');
  }
  function schedule(s, visits) {
    if (visits.length > (s.maxVisits ?? Infinity)) return null;
    let clock = s.shiftStart, from = s.startLocation, driving = 0;
    const stops = [];
    for (const c of visits) {
      if (c.salespersonId && c.salespersonId !== s.id) return null;
      const leg = travelMinutes(from, c.location);
      if (leg === Infinity) return null;
      number(leg, 'travel time');
      const arrival = clock + leg, start = Math.max(arrival, c.window?.start ?? arrival);
      const finish = start + c.serviceMinutes;
      // The full visit, not just arrival, must fit inside the appointment window.
      if (finish > s.shiftEnd || finish > (c.window?.end ?? Infinity)) return null;
      stops.push({ customerId: c.id, arrival, start, finish, travelMinutes: leg, waitingMinutes: start - arrival });
      driving += leg; clock = finish; from = c.location;
    }
    return { salespersonId: s.id, startLocation: s.startLocation, stops, travelMinutes: driving, finish: clock, elapsedMinutes: clock - s.shiftStart, returnsToStart: false };
  }
  const routes = salespeople.map(s => ({ person: s, visits: [], result: schedule(s, []) }));
  const remaining = [...customers], unassigned = [];
  while (remaining.length) {
    let best;
    for (let ci = 0; ci < remaining.length; ci++) {
      const customer = remaining[ci];
      for (let ri = 0; ri < routes.length; ri++) {
        const route = routes[ri];
        for (let position = 0; position <= route.visits.length; position++) {
          const visits = [...route.visits]; visits.splice(position, 0, customer);
          const result = schedule(route.person, visits); if (!result) continue;
          const cost = result.travelMinutes - route.result.travelMinutes;
          // Travel first; prefer a shorter workday when travel cost ties.
          if (!best || cost < best.cost || (cost === best.cost && result.elapsedMinutes < best.result.elapsedMinutes)) best = { ci, ri, visits, result, cost };
        }
      }
    }
    if (!best) {
      unassigned.push(...remaining.map(c => ({ customerId: c.id, reason: 'No feasible insertion under the supplied shifts, appointment windows, assignments, travel times and visit limits.' })));
      break;
    }
    routes[best.ri].visits = best.visits; routes[best.ri].result = best.result; remaining.splice(best.ci, 1);
  }
  return { status: 'draft', method: 'greedy-feasible-insertion', routes: routes.map(r => r.result), unassigned, totalTravelMinutes: routes.reduce((n, r) => n + r.result.travelMinutes, 0) };
}
