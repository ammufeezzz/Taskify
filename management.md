Core Structure
Workspace → Project → Issues
Each Project contains multiple Issues
Issues can have Sub-Issues
Issues and Sub-Issues are treated the same
Both have their own independent journey
Both follow the same workflow
Both have their own activity logs
Labels
Each Project has custom labels
Labels are created at the project level
A label can be assigned to an issue
When sub-issues are created:
They use the same label as the parent issue
Labels help in:
Filtering
Grouping related work
Understanding context quickly
Workflow (Mandatory)
Backlog → Todo → In Progress → Review → Done
Workflow Rules
An issue cannot be marked Done unless it passes through Review
Skipping Review is not allowed
Status transitions are strictly enforced
Review Stage Rules
When an issue is moved to Review:
The issue becomes locked
No one except the reviewer can edit it
Reviewer permissions
The reviewer can:
Move the issue to Done
Reassign the issue to another person
Send the issue back to:
Todo
In Progress
Update:
Instructions
Due date
Difficulty
Any other fields available during issue creation
Issue Journey (For Every Issue & Sub-Issue)
When an issue is clicked, it shows:
Its full journey
Status changes from creation to current state
All transitions it has gone through
Hierarchy context
Parent issue (if it exists)
Sibling issues (other sub-issues under the same parent)
Activity Logging (Mandatory)
Every issue and sub-issue logs activity, including:
Who created the issue
Who edited the issue
What field was edited
Previous value → new value
Who changed the status
Who assigned or reassigned the issue
Reviewer actions
When the issue was sent back from review
When the issue was marked Done
This creates a complete, chronological activity history.
Assignment & Delegation
Issues can be assigned to developers
Sub-issues can be created when:
More developers are needed
Work needs to be split
Sub-issues:
Retain the same label
Have their own assignees
Follow the same lifecycle and rules
Editing Rules Summary
Before Review: Creator / assignee can edit
In Review: Only the reviewer can edit
After Done: Issue is closed (no edits implied)
