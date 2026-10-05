# SalesRoute Planner

Local-first customer assignment and route planning for multiple salespeople. Each salesperson starts from home or office and may finish at the last customer; no return trip is required.

## Current status

This is an initial business project, separate from Household Connect. It contains a tested route-planning core and agreed product requirements. It is **not yet an installable business application**.

The core accepts customer locations, multiple starting locations, shift times, visit durations, appointment windows, optional visit limits, fixed salesperson assignments and a supplied travel-time function. It produces draft visit sequences, schedules and explicit unassigned visits. A greedy insertion heuristic reduces incremental travel; it does not guarantee an optimal solution or globally balanced territories.

No customer records, accounts, passwords, household database, AI models or map databases are included. GitHub stores source code; it does not host or synchronize the local business database.

## Run tests

Use Node.js 22 or later and run `npm test`. No external dependencies are needed for the planning core. Tests use fictional coordinates and artificial travel times.

## Travel data

`src/planner.mjs` requires a travel-time function returning nonnegative minutes, or Infinity for an unreachable leg. It supports directional/asymmetric travel. All times are minutes on one planning-day timeline; a visit must finish within both its appointment window and the salesperson's shift. Travel times are static, not live traffic estimates.

Offline road routing, address lookup, map display, customer uploads, login, manager approval storage, printable reports and desktop packaging remain to be implemented. The engine marks plans as drafts; approval enforcement belongs to the future application. The repository does not present straight-line distances as driving routes.

See [product requirements](docs/REQUIREMENTS.md) for the agreed direction.
