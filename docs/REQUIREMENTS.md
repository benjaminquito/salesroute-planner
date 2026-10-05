# Product requirements

## Confirmed direction

- Business customer and visit planning, separate from Household Connect.
- Multiple salespeople, each starting from home or office.
- Open routes: finish at the last customer without a mandatory return.
- Assign nearby customers and propose efficient visit sequences.
- Local storage and offline operation; no third-party AI connection.
- Private GitHub repository named salesroute-planner; app name SalesRoute Planner.

## Proposed first application workflow

1. Enter or upload customers and confirm their mapped locations.
2. Add salespeople, starting locations, working hours and visit limits.
3. Specify visit durations and optional appointment windows.
4. Calculate road-based travel times offline and generate draft assignments/routes.
5. Show unreachable or infeasible visits without silently dropping them.
6. Allow a manager to inspect, adjust, recalculate and approve a plan.
7. Print each salesperson's visit sequence and schedule.

Manager approval, customer imports, authentication, reports and packaging are planned application features, not completed capabilities of this initial repository. The existing church-specific fields and 15-person Group rules do not apply to this business project.

## Planning core implemented

Greedy feasible insertion across multiple open routes, supplied directional travel times, shift and visit-window constraints, fixed salesperson assignments, maximum visits, and explicit unassigned visits. The heuristic does not prove optimality and may leave a visit unassigned when a different global arrangement could serve it. Workload balancing is currently only a tie-break on equal incremental travel cost.

## Later decisions

Confirm business-specific customer fields, service territory, workload priorities, recurring visits, breaks, vehicle/skill constraints, role permissions and installer targets. Road data quality and travel-time assumptions must be shown in the application. Production use requires end-to-end testing of storage, authorization, import validation, backup/restore and routing.
