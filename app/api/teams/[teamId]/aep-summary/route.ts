import { NextRequest, NextResponse } from 'next/server'
import { getUserId, verifyTeamMembership } from "@/lib/auth-server-helpers"
import { db } from '@/lib/db'

export interface AepUserSummary {
  userName: string
  userId: string
  sClosed: number
  mClosed: number
  lClosed: number
  totalClosed: number
  onTimeClosed: number
  delayedClosed: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const { teamId } = await params
    const userId = await getUserId()

    // Verify team membership
    await verifyTeamMembership(teamId, userId)

    // Get filter parameters
    const projectId = searchParams.get('projectId') || undefined
    const filterUserId = searchParams.get('userId') || undefined

    // Fetch team members to get accurate user names (in case issue.assignee is null)
    const teamMembers = await db.teamMember.findMany({
      where: { teamId },
      select: { userId: true, userName: true }
    })
    const memberNameMap = new Map(teamMembers.map(m => [m.userId, m.userName]))

    // First, get workflow states with type = 'completed' for this team
    const completedStates = await db.workflowState.findMany({
      where: {
        teamId,
        type: 'completed'
      },
      select: { id: true }
    })

    const completedStateIds = completedStates.map(s => s.id)

    if (completedStateIds.length === 0) {
      // No completed workflow states, return empty
      return NextResponse.json([])
    }

    // Build the where clause for issues
    // 🔒 HARD RULE: Count issues that passed through Review stage
    // OR legacy issues (completed before Review workflow was implemented)
    const whereClause: any = {
      teamId,
      workflowStateId: { in: completedStateIds },
      // Include both:
      // 1. New issues that passed through Review (reviewedAt is not null)
      // 2. Legacy issues completed before Review workflow (reviewedAt is null)
      // This OR condition means: include ALL completed issues (new and legacy)
      OR: [
        { reviewedAt: { not: null } }, // New workflow - must have passed Review
        { reviewedAt: null } // Legacy issues - completed before Review workflow
      ]
    }

    if (projectId) {
      whereClause.projectId = projectId
    }

    // Build AND conditions to combine review requirement with assignee filter
    const andConditions: any[] = []
    
    // Review condition: Include new issues (with reviewedAt) OR legacy issues (without reviewedAt)
    // This effectively includes ALL completed issues
    andConditions.push({
      OR: [
        { reviewedAt: { not: null } }, // New workflow - must have passed Review
        { reviewedAt: null } // Legacy issues - completed before Review workflow
      ]
    })

    // Assignee condition
    if (filterUserId) {
      andConditions.push({
        OR: [
          { assigneeId: filterUserId },
          { assignees: { some: { userId: filterUserId } } }
        ]
      })
    } else {
      // Only count issues with at least one assignee (legacy or new)
      andConditions.push({
        OR: [
          { assigneeId: { not: null } },
          { assignees: { some: {} } }
        ]
      })
    }

    whereClause.AND = andConditions

    // Fetch all completed issues matching the criteria
    // Include updatedAt as fallback for completedAt (for legacy issues)
    // Include assignees relation for multiple assignees
    const completedIssues = await db.issue.findMany({
      where: whereClause,
      select: {
        id: true,
        assigneeId: true,
        assignee: true,
        assignees: true, // Multiple assignees
        difficulty: true,
        completedAt: true,
        reviewedAt: true,
        updatedAt: true,  // Fallback for legacy issues without completedAt
        dueDate: true,
      }
    })

    // Group issues by assignee and calculate metrics
    // An issue with multiple assignees is counted for EACH assignee
    const userMap = new Map<string, AepUserSummary>()

    // Helper to process a single assignee for an issue
    const processAssignee = (userId: string, userName: string, issue: typeof completedIssues[0]) => {
      let userSummary = userMap.get(userId)
      if (!userSummary) {
        userSummary = {
          userName,
          userId,
          sClosed: 0,
          mClosed: 0,
          lClosed: 0,
          totalClosed: 0,
          onTimeClosed: 0,
          delayedClosed: 0,
        }
        userMap.set(userId, userSummary)
      }

      // Count by difficulty
      if (issue.difficulty === 'S') {
        userSummary.sClosed++
      } else if (issue.difficulty === 'M') {
        userSummary.mClosed++
      } else if (issue.difficulty === 'L') {
        userSummary.lClosed++
      }

      // Total closed
      userSummary.totalClosed++

      // On-time vs Delayed
      // Fair approach: Compare reviewedAt (when assignee got it to Review) vs dueDate
      // This way, reviewer delays don't count against the assignee
      // For legacy issues (no reviewedAt), use completedAt as fallback
      if (issue.dueDate) {
        // Use reviewedAt for new workflow, completedAt for legacy issues
        const comparisonDate = issue.reviewedAt || issue.completedAt || issue.updatedAt
        if (comparisonDate) {
          // Normalize dates to midnight (date-only comparison, ignore time)
          const compareDate = new Date(comparisonDate)
          compareDate.setHours(0, 0, 0, 0)
          
          const dueDate = new Date(issue.dueDate)
          dueDate.setHours(0, 0, 0, 0)
          
          // On-time if assignee got it to Review (or completed for legacy) on or before due date
          // Reviewer delay doesn't count against assignee
          if (compareDate <= dueDate) {
            userSummary.onTimeClosed++
          } else {
            userSummary.delayedClosed++
          }
        }
      }
    }

    for (const issue of completedIssues) {
      // Check for multiple assignees first (new system)
      if (issue.assignees && issue.assignees.length > 0) {
        for (const assignee of issue.assignees) {
          processAssignee(assignee.userId, assignee.userName, issue)
        }
      } else if (issue.assigneeId) {
        // Fallback to legacy single assignee
        const userName = issue.assignee || memberNameMap.get(issue.assigneeId) || 'Unknown'
        processAssignee(issue.assigneeId, userName, issue)
      }
    }

    // Convert map to array and sort by total closed (descending)
    const result = Array.from(userMap.values()).sort((a, b) => b.totalClosed - a.totalClosed)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching AEP summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch AEP summary' },
      { status: 500 }
    )
  }
}

