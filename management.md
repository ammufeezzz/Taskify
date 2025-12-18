Workedge – AEP Phase 1 Tracking & Management Tab Enhancement

1. Background & Objective
1.1 Background
Workedge is the internal task and project management platform used by the Acredge team to manage day-to-day execution.
Currently, the system supports:
Projects (e.g. Dec’25)
Issues with basic lifecycle tracking
However, leadership requires clear, objective visibility into:
Who is closing tickets
What difficulty of work is being delivered
Whether work is being delivered on time

1.2 Objective (Core Purpose)
The objective of AEP Phase 1 is to answer one simple, critical question:
Who closed how many tickets, of what difficulty (S/M/L), and whether they were closed on time or delayed?
This phase focuses only on output discipline, not behavior, learning, or ownership scoring.
This data will later act as the foundation for the Acredge Excellence Program (AEP).

2. Scope & Constraints
2.1 What This Phase Includes
Use of existing issue data
Simple derived calculations
A single table added to the Management Tab
Project-wise and user-wise filtering
Automatic, objective tracking

2.2 Explicit Out of Scope (Important)
❌ No new tabs
❌ No new pages
❌ No final AEP score
❌ No collaboration / learning / bug metrics
❌ No manual data entry
❌ No new issue fields except those already existing
This is intentionally simple and minimal.

3. Existing System Assumptions
The system already has:
3.1 Projects
Example: Dec’25
Issues are always created under a project

3.2 Issues
Each issue already contains:
Title
Assignee
Due Date
Stage (Todo / In Progress / Done / Blocked)
Difficulty Level → S / M / L (already exists)
⚠️ No new issue fields are required for this phase.

4. Definitions & Logic
4.1 What Counts as a “Closed Ticket”
An issue is considered closed when:
stage = Done
System completion timestamp exists (completed_at or equivalent)

4.2 Timeliness Logic
For closed issues only:
On-Time Closed
completed_at ≤ due_date
Delayed Closed
completed_at > due_date
No other states are needed.

5. AEP Phase 1 – Metrics Tracked
Only the following metrics will be tracked.
Grouping Logic
Data grouped by Assignee (User)
Filtered by Project

6. Management Tab Enhancement
6.1 Location
Use the existing Management Tab
Add the new section below existing content
No UI redesign required

6.2 Section Title
AEP – Monthly Closure Summary

6.3 Filters (Mandatory)
Place filters above the table.
Project Filter
Dropdown
Default: current active project (e.g. Dec’25)
User Filter
Dropdown
Default: All Users
If a user is selected, show only that user’s row
Filters must:
Work together
Update table data dynamically

7. AEP Summary Table (Final & Locked)
7.1 Table Columns
Column Name
Description
User Name
Assignee name
S Closed
Number of Small (S) tickets closed
M Closed
Number of Medium (M) tickets closed
L Closed
Number of Large (L) tickets closed
Total Closed
S + M + L
On-Time Closed
Tickets closed on or before due date
Delayed Closed
Tickets closed after due date

⚠️ No additional columns should be added in Phase 1.

7.2 Calculation Rules (Exact)
For each user within the selected project:
S Closed = count(issues where stage = Done AND difficulty = S)
M Closed = count(issues where stage = Done AND difficulty = M)
L Closed = count(issues where stage = Done AND difficulty = L)

Total Closed = S Closed + M Closed + L Closed

On-Time Closed = count(issues where stage = Done AND completed_at <= due_date)
Delayed Closed = count(issues where stage = Done AND completed_at > due_date)
