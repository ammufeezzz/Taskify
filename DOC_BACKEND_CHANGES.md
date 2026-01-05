You are implementing a strict Final Review System as a mandatory quality gate between "In Progress" and "Done" for all tickets. No ticket can transition directly from In Progress → Done. Review ensures requirements are met, quality standards are upheld, ticket intent is respected, and accountability is preserved.

**CORE WORKFLOW:**
1. **Entering Review** (In Progress → Pending Review)
   - Trigger: All planned work completed + assignee believes acceptance criteria met
   - System: Makes ticket READ-ONLY (no scope/logic/description edits by assignee)

2. **ROLES:**
   - **Assignee**: Views comments, cannot edit, retains full ownership/credit
   - **Reviewer**: Decision authority only, cannot edit content, all actions logged

3. **REVIEWER ACTIONS (STRICTLY LIMITED):**
   ✅ **Approve & Close → Done**: All criteria met, no issues → ticket immutable, metrics recorded
   
   🔁 **Request Changes → In Progress**: Fixes needed → MANDATORY comment (what's wrong + what to fix)
   
   🔄 **Re-plan → Todo**: Scope misunderstood → MANDATORY explanation
   
   🚫 **Archive → Backlog** (rare): Business decision → MANDATORY reason

4. **HARD NON-NEGOTIABLE RULES:**
   - NO direct In Progress → Done
   - Review = READ-ONLY (no silent fixes, no scope edits)
   - EVERY non-Approve action REQUIRES comment
   - Ownership NEVER transfers (reviewer gets no credit)
   - All actions audited

5. **AUDIT LOG (MANDATORY FOR EVERY REVIEW):**
   - Reviewer identity
   - Decision taken
   - Comments
   - Time in Review