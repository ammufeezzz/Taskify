## Backend/API changes needed for new UI fields

This UI work added **assignee filter**, **end date**, **difficulty (S/M/L)** inputs, and two management insights. Backend is not yet wired. Steps for the backend dev:

### 1) Database (Prisma)
- Update `Issue` model:
  - `endDate   DateTime?`
  - `difficulty String?` (or enum: `enum Difficulty { S M L }` and use `difficulty Difficulty?`)
- Run:
  - `npx prisma migrate dev --name add-issue-enddate-difficulty`
  - `npx prisma generate`

### 2) Types
- Extend `CreateIssueData` and `UpdateIssueData` in `lib/types/index.ts` with optional `endDate?: string | Date` and `difficulty?: 'S' | 'M' | 'L'`.
- Add these fields to any Zod schemas or form types in actions/hooks that use them.

### 3) Issue create/update APIs
- In `app/api/teams/[teamId]/issues/route.ts` and `lib/api/issues.ts`:
  - Accept `endDate` and `difficulty` in request body.
  - Validate optional types.
  - Persist to Prisma create/update calls.
- Update select clauses so responses include `endDate` and `difficulty`.

### 4) Issue filters
- Extend `IssueFilters` to include:
  - `endDate?: string` (or range if desired)
  - `difficulty?: string[]`
  - `assignee` is already present; ensure GET handler maps `assignee` query param to `where.assigneeId`.
- In `lib/api/issues.ts` `getIssues`, add `where` clauses for `difficulty` and `endDate` (e.g., `lte`).
- Frontend now sends assignee filter; ensure `/api/teams/[teamId]/issues` supports `assignee` query param (add if missing).

### 5) Issue read models
- Update `IssueWithRelations` type to include `endDate?: Date | null` and `difficulty?: 'S' | 'M' | 'L' | null`.
- Update Issue card/table/list renderers if you want to display the new fields.

### 6) Management insights data
- Add new API shape (can extend `/api/teams/[teamId]/stats` or create a new route):
  - Input: optional `projectId` query param.
  - Output:
    - `completedByUser`: array of `{ userName: string; userId: string; count: number }` for issues whose workflow state type is `completed` (and project filter applied).
    - `ticketsByDifficulty`: array of `{ userName: string; difficulty: 'S' | 'M' | 'L'; count: number }` (filter by project if provided).
- Implementation sketch (Prisma):
  - Fetch issues scoped to team (and project if provided) joined with workflow state.
  - Completed tickets: `groupBy` on `assignee`/`assigneeId` where `workflowState.type === 'completed'`.
  - Difficulty split: `groupBy` on `assignee`/`assigneeId` and `difficulty`.
  - Return zero-safe arrays; keep existing stats payload intact.

### 7) Hooks/UI wiring
- Add a new hook (or extend `useTeamStats`) to fetch the new stats and pass `projectId` as query param.
- In `ManagementPageClient`, replace placeholder arrays with real data and render charts/tables accordingly.

### 8) Tests/manual checks
- Create issue with end date + difficulty.
- Update issue fields.
- Filter by assignee/difficulty/end date; verify API results.
- Management stats return data with and without project filter.

### 9) Deploy notes
- Ensure env and DB migrations run before deploying.
- Regenerate Prisma client on build agents.

