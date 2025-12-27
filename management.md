3. Updated Task Lifecycle (LOCKED)
Old Flow
Backlog → Todo → In Progress → Done

New Flow (MANDATORY)
Backlog → Todo → In Progress → Review → Done

🔒 Hard Rule
A ticket CANNOT move to Done from any stage except Review
Direct In Progress → Done transition must be blocked at system level

4. Review Stage – How It Works
4.1 Entering Review
Assignee moves ticket:
In Progress → Review

Ticket status becomes Pending Review
Ticket is NOT counted in performance or closure metrics

4.2 Reviewer Assignment (Phase 1 – FINAL DECISION)
Default reviewer = Founder
No auto-random reviewer for now
No notifications required (notification system deferred)
Founder actions in Review:
Review & close the ticket
Reassign ticket to:
Designer
Senior developer
Send ticket back to Todo / In Progress if needed

5. Review Outcome & Closure Rules
5.1 Review Outcomes (Internal Logic)
When founder reviews the ticket, they can:
Approve & Close
Send Back for Changes
Reassign for Secondary Review

5.2 Performance Credit Rule (VERY IMPORTANT)
Performance credit always goes to the original ticket assignee
Reviewer (founder / designer / senior dev) gets NO performance credit
Reviewers are validating, not executing

5.3 Closure & AEP Counting Logic
A ticket is counted as closed ONLY IF:
stage = Done
AND ticket passed through Review stage

Tickets closed directly by reviewer still count for the assignee
Reviewer never gains closure count

6. Notifications (Deferred)
❌ No in-app notification system for now
❌ No email
❌ No SMS
This feature is postponed to a later phase.

7. Ticket Deletion Permissions (NEW RULE)
7.1 Who Can Delete Tickets
Role
Can Delete Ticket
Team Owner
✅ Yes
Admin
✅ Yes
Developer
❌ No


7.2 Deletion Rules
Developers should never delete tickets they created
This prevents:
Hiding poor-quality work
Gaming metrics
Loss of audit trail

8. What This System Prevents
Small bug spamming
Artificial ticket inflation
Skipping quality checks
Developer self-approval
Metric manipulation
UI clutter & security risk
