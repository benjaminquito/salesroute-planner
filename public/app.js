const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock = n => `${String(Math.floor(Math.round(n)/60)).padStart(2,'0')}:${String(Math.round(n)%60).padStart(2,'0')}`;
const minute = s => s ? s.split(':').reduce((h,m) => Number(h)*60+Number(m)) : NaN;
let state, editingKind, busy = false;
function notice(message, error = false) { $('#notice').textContent = message; $('#notice').className = error ? 'error' : ''; }
async function api(path, body) {
  const response = await fetch(path, body ? { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) } : {});
  const result = await response.json(); if (!response.ok) throw Error(result.error); return result;
}
async function save(workspace) {
  if (busy) throw Error('Please wait for the current save.');
  busy = true;
  try { state = await api('/api/workspace', { revision:state.revision, workspace }); render(); notice('Saved on this computer. Generate routes again after changes.'); }
  finally { busy = false; }
}
function view(name) {
  document.querySelectorAll('.view').forEach(el => el.hidden = el.id !== name);
  document.querySelectorAll('nav button').forEach(el => el.classList.toggle('active', el.dataset.view === name));
  $('#page-title').textContent = ({overview:'Overview',customers:'Customers',salespeople:'Salespeople',routes:'Routes & schedules'})[name];
}
function render() {
  const w = state.workspace;
  $('#stats').innerHTML = [[w.customers.length,'Customer visits'],[w.salespeople.length,'Salespeople'],[state.plan ? state.plan.unassigned.length : '—','Unassigned visits']].map(([n,label]) => `<div class="stat"><span>${label}</span><b>${n}</b></div>`).join('');
  renderCustomers();
  $('#team').innerHTML = w.salespeople.length ? w.salespeople.map(s => `<article class="card"><p class="eyebrow">${esc(s.id)}</p><h2>${esc(s.name)}</h2><p>${esc(s.address)}</p><p>${clock(s.shiftStart)}–${clock(s.shiftEnd)} · Up to ${s.maxVisits} visits</p><p class="muted">Starts at ${s.startLocation.lat}, ${s.startLocation.lon}<br>Finishes at the last customer</p><div class="actions"><button data-edit="salesperson" data-id="${esc(s.id)}">Edit</button><button data-delete="salesperson" data-id="${esc(s.id)}">Delete</button></div></article>`).join('') : '<div class="empty">Add a salesperson to choose your first starting point.</div>';
  $('#travel-mode').value = w.travelMode; $('#speed').value = w.speedKmh; travelHelp();
  renderPlan();
}
function renderCustomers() {
  const w = state.workspace, query = $('#customer-search').value.toLowerCase();
  const rows = w.customers.filter(c => `${c.name} ${c.address} ${c.id}`.toLowerCase().includes(query));
  $('#customer-rows').innerHTML = rows.map(c => `<tr><td><b>${esc(c.name)}</b><small>${esc(c.id)}</small></td><td>${esc(c.address)}</td><td>${c.serviceMinutes} min</td><td>${c.window ? `${clock(c.window.start)}–${clock(c.window.end)}` : 'Flexible'}</td><td>${esc(w.salespeople.find(s => s.id === c.salespersonId)?.name || 'Automatic')}</td><td><button data-edit="customer" data-id="${esc(c.id)}">Edit</button><button data-delete="customer" data-id="${esc(c.id)}">Delete</button></td></tr>`).join('') || '<tr><td colspan="6">No customers found. Add a customer or load the fictional example from Overview.</td></tr>';
}
function renderPlan() {
  const p = state.plan, w = state.workspace;
  $('#print').disabled = !p;
  if (!p) { $('#plan').innerHTML = '<div class="empty"><h3>Your next route starts here</h3><p>Add your team and customers, choose travel settings, then generate a draft.</p></div>'; return; }
  $('#plan').innerHTML = `<p class="warning">${esc(p.travelLabel)}. Draft for review — not approved for dispatch.</p><p class="muted">Generated ${esc(new Date(p.generatedAt).toLocaleString())} · ${Math.round(p.totalTravelMinutes)} total travel minutes · Routes finish at the last customer.</p>` + p.routes.map(r => {
    const s = w.salespeople.find(s => s.id === r.salespersonId);
    return `<article class="card route"><div class="route-title"><h2>${esc(s.name)}</h2><span class="badge">${r.stops.length} VISITS · DRAFT</span></div><p>Start: ${esc(s.address)} · ${clock(s.shiftStart)}<br>Finish: ${clock(r.finish)} · Travel: ${Math.round(r.travelMinutes)} min</p><div class="table-wrap"><table><thead><tr><th>Stop</th><th>Customer / address</th><th>Travel</th><th>Arrive</th><th>Visit</th></tr></thead><tbody>${r.stops.map((stop,i) => {const c = w.customers.find(c => c.id === stop.customerId); return `<tr><td>${i+1}</td><td><b>${esc(c.name)}</b><small>${esc(c.address)}</small></td><td>${Math.round(stop.travelMinutes)} min</td><td>${clock(stop.arrival)}</td><td>${clock(stop.start)}–${clock(stop.finish)}${stop.waitingMinutes ? `<small>${Math.round(stop.waitingMinutes)} min waiting</small>` : ''}</td></tr>`;}).join('') || '<tr><td colspan="5">No visits assigned.</td></tr>'}</tbody></table></div></article>`;
  }).join('') + (p.unassigned.length ? `<article class="card unassigned"><h2>Unassigned visits (${p.unassigned.length})</h2><p>These visits need review. Check working hours, appointment windows, fixed assignments, visit limits and available travel times.</p><ul>${p.unassigned.map(u => `<li><b>${esc(w.customers.find(c => c.id === u.customerId)?.name)}</b> — ${esc(u.reason)}</li>`).join('')}</ul></article>` : '<p>All customers appear exactly once in the draft schedules.</p>');
}
function travelHelp() {
  const estimate = $('#travel-mode').value === 'estimate';
  $('#speed-label').hidden = !estimate;
  $('#travel-help').textContent = estimate ? 'Testing only: travel uses straight-line distance and an assumed speed. It does not follow roads, account for traffic or provide driving directions.' : `${state.workspace.travelTimes.length} supplied directional legs. Missing or null legs are unreachable. Verify the supplied times before using the schedule.`;
}
function openEditor(kind, id) {
  editingKind = kind; const form = $('#entry-form'); form.reset(); $('#form-error').textContent = '';
  $('#editor-title').textContent = `${id ? 'Edit' : 'Add'} ${kind}`;
  $('#customer-fields').hidden = kind !== 'customer'; $('#salesperson-fields').hidden = kind !== 'salesperson';
  $('#customer-fields').querySelectorAll('input,select').forEach(e => e.disabled = kind !== 'customer');
  $('#salesperson-fields').querySelectorAll('input').forEach(e => e.disabled = kind !== 'salesperson');
  form.elements.salespersonId.innerHTML = '<option value="">Automatic assignment</option>' + state.workspace.salespeople.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  form.elements.id.value = id || '';
  if (id) {
    const row = state.workspace[kind === 'customer' ? 'customers' : 'salespeople'].find(r => r.id === id);
    for (const key of ['name','address','serviceMinutes','maxVisits','salespersonId']) if (row[key] !== undefined) form.elements[key].value = row[key];
    const location = row.location || row.startLocation; form.elements.lat.value = location.lat; form.elements.lon.value = location.lon;
    for (const key of ['shiftStart','shiftEnd']) if (row[key] !== undefined) form.elements[key].value = clock(row[key]);
    if (row.window) { form.elements.windowStart.value = clock(row.window.start); form.elements.windowEnd.value = clock(row.window.end); }
  }
  $('#editor').showModal();
}
$('#entry-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target; const f = Object.fromEntries(new FormData(form));
  const row = { id:f.id || `${editingKind === 'customer' ? 'C' : 'S'}-${crypto.randomUUID().slice(0,8)}`, name:f.name.trim(), address:f.address.trim() };
  const location = { lat:Number(f.lat), lon:Number(f.lon) };
  if (editingKind === 'customer') {
    Object.assign(row, { location, serviceMinutes:Number(f.serviceMinutes), salespersonId:f.salespersonId });
    if (f.windowStart || f.windowEnd) row.window = { start:minute(f.windowStart), end:minute(f.windowEnd) };
  } else Object.assign(row, { startLocation:location, shiftStart:minute(f.shiftStart), shiftEnd:minute(f.shiftEnd), maxVisits:Number(f.maxVisits) });
  const w = structuredClone(state.workspace), key = editingKind === 'customer' ? 'customers' : 'salespeople';
  const index = w[key].findIndex(r => r.id === row.id); const previous = w[key][index];
  if (index >= 0) w[key][index] = row; else w[key].push(row);
  // Travel times depend on locations; changing one invalidates every touching leg.
  if (previous && (previous.address !== row.address || JSON.stringify(previous.location || previous.startLocation) !== JSON.stringify(location))) w.travelTimes = w.travelTimes.filter(l => l.from !== row.id && l.to !== row.id);
  try { await save(w); $('#editor').close(); } catch(e) { $('#form-error').textContent = e.message; }
});
document.addEventListener('click', async event => {
  const b = event.target.closest('button'); if (!b) return;
  if (b.dataset.view) view(b.dataset.view);
  if (b.dataset.edit) openEditor(b.dataset.edit, b.dataset.id);
  if (b.dataset.delete) {
    const kind = b.dataset.delete, id = b.dataset.id;
    if (!confirm(`Delete this ${kind}? Saved draft routes will be cleared.`)) return;
    const w = structuredClone(state.workspace), key = kind === 'customer' ? 'customers' : 'salespeople';
    if (kind === 'salesperson' && w.customers.some(c => c.salespersonId === id)) return notice('Reassign this salesperson’s fixed customers before deleting.', true);
    w[key] = w[key].filter(r => r.id !== id); w.travelTimes = w.travelTimes.filter(l => l.from !== id && l.to !== id);
    try { await save(w); } catch(e) { notice(e.message,true); }
  }
});
$('#add-customer').onclick = () => openEditor('customer'); $('#add-salesperson').onclick = () => openEditor('salesperson');
$('#close-editor').onclick = $('#cancel-editor').onclick = () => $('#editor').close();
$('#customer-search').oninput = renderCustomers; $('#travel-mode').onchange = travelHelp;
$('#save-settings').onclick = async () => { try { await save({ ...state.workspace, travelMode:$('#travel-mode').value, speedKmh:Number($('#speed').value) }); } catch(e) { notice(e.message,true); } };
$('#generate').onclick = async () => {
  if (busy) return; const button = $('#generate'); button.disabled = true;
  try {
    if (state.workspace.travelMode !== $('#travel-mode').value || state.workspace.speedKmh !== Number($('#speed').value)) await save({ ...state.workspace, travelMode:$('#travel-mode').value, speedKmh:Number($('#speed').value) });
    busy = true; state = await api('/api/plan', { revision:state.revision }); render(); notice('Draft routes saved. Review unassigned visits and travel assumptions before printing.');
  } catch(e) { notice(e.message,true); } finally { busy = false; button.disabled = false; }
};
$('#print').onclick = () => { view('routes'); window.print(); };
function download(name, value) { const url = URL.createObjectURL(new Blob([JSON.stringify(value,null,2)], {type:'application/json'})); const a = document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000); }
$('#export').onclick = () => download('salesroute-workspace.json', { version:1, workspace:state.workspace });
$('#travel-template').onclick = () => {
  const w = state.workspace, existing = new Map(w.travelTimes.map(l => [JSON.stringify([l.from,l.to]),l.minutes]));
  download('salesroute-travel-times.json', [...w.salespeople,...w.customers].flatMap(a => w.customers.filter(b => b.id !== a.id).map(b => ({ from:a.id, to:b.id, minutes:existing.get(JSON.stringify([a.id,b.id])) ?? null }))));
};
async function readImport(input) {
  const file = input.files[0]; if (!file) return null; if (file.size > 2_000_000) throw Error('Choose a JSON file smaller than 2 MB.'); return JSON.parse(await file.text());
}
$('#import').onchange = async event => { try { const data = await readImport(event.target); if (!data) return; if (data.version !== 1 || !data.workspace) throw Error('Use an exported version 1 workspace.'); if (confirm('Replace this workspace with the imported customers and team? Export a copy first if needed.')) await save(data.workspace); } catch(e) { notice(e.message,true); } finally { event.target.value=''; } };
$('#import-times').onchange = async event => { try { const travelTimes = await readImport(event.target); if (!travelTimes) return; if (confirm('Replace supplied travel times with this file?')) await save({ ...state.workspace, travelTimes, travelMode:'supplied' }); } catch(e) { notice(e.message,true); } finally { event.target.value=''; } };
$('#demo').onclick = async () => {
  if ((state.workspace.customers.length || state.workspace.salespeople.length) && !confirm('Replace this workspace with fictional examples? Export your data first if needed.')) return;
  const salespeople = [
    {id:'S-DEMO-1',name:'Alex Example',address:'Fictional office — Kitchener',startLocation:{lat:43.4516,lon:-80.4925},shiftStart:540,shiftEnd:1020,maxVisits:6},
    {id:'S-DEMO-2',name:'Jamie Sample',address:'Fictional home — Guelph',startLocation:{lat:43.5448,lon:-80.2482},shiftStart:540,shiftEnd:1020,maxVisits:6}
  ];
  const locations = [[43.46,-80.51,'Kitchener'],[43.48,-80.53,'Waterloo'],[43.36,-80.31,'Cambridge'],[43.55,-80.26,'Guelph'],[43.52,-80.24,'Guelph'],[43.44,-80.48,'Kitchener']];
  const customers = locations.map(([lat,lon,city],i) => ({id:`C-DEMO-${i+1}`,name:`Fictional Customer ${i+1}`,address:`Sample location ${i+1} — ${city}`,location:{lat,lon},serviceMinutes:30,...(i===2 ? {window:{start:600,end:780}} : {})}));
  try { await save({ customers, salespeople, travelMode:'estimate', speedKmh:40, travelTimes:[] }); notice('Loaded six fictional customers and two fictional salespeople. No real customer addresses are included.'); } catch(e) { notice(e.message,true); }
};
try { state = await api('/api/workspace'); render(); } catch(e) { notice(`Could not load the workspace: ${e.message}. Reopen the local application.`,true); document.querySelectorAll('button,input').forEach(e => e.disabled=true); }
