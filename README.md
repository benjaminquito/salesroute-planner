# SalesRoute Planner

A local browser application for assigning customer visits across multiple salespeople. Each person starts at home or an office and finishes at the last customer, with no mandatory return trip.

## Version 0.2 — working local prototype

- Customer entry, editing and search; visit lengths, appointment windows and fixed salesperson assignments.
- Salesperson entry and editing, separate starting locations, working hours and visit limits.
- Draft route generation, explicit unassigned visits and printable schedules.
- Local disk storage, JSON workspace import/export and a previous-save recovery file.
- Directional travel-time JSON imports or explicitly labelled straight-line test estimates.
- A fictional six-customer, two-salesperson example, loaded only when requested.

This is not yet a production or installable desktop application. Login, manager approval, automatic address lookup, offline road routing, a geographic map, CSV/Excel import and desktop packaging are still planned. Routes remain drafts; this version does not claim approval enforcement. It is intended for one trusted user on one computer.

## Run

Install Node.js 22 or later. From this folder:

```sh
npm start
```

Open **http://127.0.0.1:47840**. Keep the terminal running; stop with Ctrl+C. No package installation or third-party AI account is needed. The server listens on loopback only and accepts only its own host and origin. It is not a shared network service. Do not expose it through a proxy or public tunnel.

Use **Overview → Load fictional example**, then **Routes & schedules → Generate draft routes** to try it. Change a customer's assigned salesperson to move their visit, then regenerate. Editing or importing data clears the saved draft to prevent printing an outdated schedule.

## Travel assumptions

Addresses are descriptive only: enter confirmed latitude and longitude. Test estimates use great-circle distance at the selected speed; they do not follow roads, account for traffic or provide driving directions. Supplied travel times are directional and static. Download the template from Routes & schedules, fill in minutes for each leg and import it. Missing or `null` legs are unreachable. There is no inferred reverse leg.

```json
[
  { "from": "S-DEMO-1", "to": "C-DEMO-1", "minutes": 12 },
  { "from": "C-DEMO-1", "to": "C-DEMO-2", "minutes": 8 }
]
```

Changing a starting or customer address/coordinate removes all supplied legs touching that record. Re-import updated times before planning. All times are on one day; each visit must finish within both its appointment window and the salesperson's shift. Overnight scheduling is not supported. The prototype limits input to 100 customers and 20 salespeople.

The core uses greedy feasible insertion. It does not prove an optimal solution or globally balanced territories and can leave visits unassigned when another arrangement would work. Inspect every unassigned visit and route before operational use.

## Storage and recovery

The default workspace is `data/workspace.json`, separate from Household Connect. Override with `SALESROUTE_DATA_DIR`; change the local port with `PORT`. Writes use a temporary file and atomic rename. The immediately previous save is retained in `data/workspace.json.previous`. Stop the server before restoring that file. Export workspace copies regularly; the previous-save file is not a full backup history. Workspace imports replace the current workspace after confirmation and are validated before saving. Open windows use revision checks to reject stale saves.

No accounts, customer database, passwords, Household Connect data, AI models or map databases are committed to GitHub. The app makes no external network requests. Local files and exported workspaces are not encrypted; protect them with the computer's own account and disk security. There is no login in this prototype.

## Tests

```sh
npm test
```

Nine automated tests cover route constraints, asymmetric travel, unassigned visits, input validation, save conflicts, host/origin checks, persistence, restart and draft invalidation. All examples use fictional data. See [product requirements](docs/REQUIREMENTS.md) for the intended final workflow.
