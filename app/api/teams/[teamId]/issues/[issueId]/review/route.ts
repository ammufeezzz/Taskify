import { NextRequest, NextResponse } from 'next/server'
import { getUserId, getUser } from '@/lib/auth-server-helpers'
import { db } from '@/lib/db'
import { updateIssue } from '@/lib/api/issues'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; issueId: string }> }
) {
  try {
    const { teamId, issueId } = await params
    const [userId, user] = await Promise.all([getUserId(), getUser()])
    const userName = user.name || user.email || 'Unknown'
    const body = await request.json()
    const { action, targetStateId, reviewerId, reason } = body

    // Verify user is a team member and has admin/owner role
    const teamMember = await db.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      select: { role: true },
    })

    if (!teamMember) {
      return NextResponse.json(
        { error: 'Unauthorized: Not a team member' },
        { status: 403 }
      )
    }

    // Get current issue (including reviewerId for permission check)
    const issue = await db.issue.findUnique({
      where: { id: issueId },
      select: {
        workflowStateId: true,
        workflowState: {
          select: { type: true }
        },
        reviewerId: true,
      }
    })

    if (!issue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      )
    }

    // Verify issue is in Review state
    if (issue.workflowState.type !== 'review') {
      return NextResponse.json(
        { error: 'Issue must be in Review state to perform review actions' },
        { status: 400 }
      )
    }

    // Check if user can perform review actions:
    // - Owner can always review
    // - Admin can always review
    // - The assigned reviewer can review
    const isOwnerOrAdmin = teamMember.role === 'owner' || teamMember.role === 'admin'
    const isAssignedReviewer = userId === issue.reviewerId
    
    if (!isOwnerOrAdmin && !isAssignedReviewer) {
      return NextResponse.json(
        { error: 'Unauthorized: Only the assigned reviewer, Owners, or Admins can perform review actions' },
        { status: 403 }
      )
    }

    // Get workflow states for the team
    const workflowStates = await db.workflowState.findMany({
      where: { teamId }
    })

    let newWorkflowStateId: string | undefined
    let newReviewerId: string | undefined = undefined

    switch (action) {
      case 'approve':
        // Approve & Close - move to Done
        const doneState = workflowStates.find(s => s.type === 'completed')
        if (!doneState) {
          return NextResponse.json(
            { error: 'Done workflow state not found' },
            { status: 400 }
          )
        }
        newWorkflowStateId = doneState.id
        break

      case 'send_back':
        // Send Back for Changes - move to Todo or In Progress
        // Reason is MANDATORY for send_back actions
        if (!reason || reason.trim().length < 10) {
          return NextResponse.json(
            { error: 'A detailed reason is required when sending back an issue (at least 10 characters)' },
            { status: 400 }
          )
        }
        
        if (targetStateId) {
          newWorkflowStateId = targetStateId
        } else {
          // Default to Todo if no target specified
          const todoState = workflowStates.find(s => s.type === 'unstarted')
          if (!todoState) {
            return NextResponse.json(
              { error: 'Todo workflow state not found' },
              { status: 400 }
            )
          }
          newWorkflowStateId = todoState.id
        }
        break

      case 'reassign':
        // Reassign for Secondary Review - change reviewer
        if (!reviewerId) {
          return NextResponse.json(
            { error: 'reviewerId is required for reassign action' },
            { status: 400 }
          )
        }
        
        // Get reviewer info
        const reviewer = await db.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId,
              userId: reviewerId,
            },
          },
          select: { userId: true, userName: true }
        })

        if (!reviewer) {
          return NextResponse.json(
            { error: 'Reviewer not found in team' },
            { status: 404 }
          )
        }

        newReviewerId = reviewer.userId
        // Keep issue in Review, just change reviewer
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: approve, send_back, or reassign' },
          { status: 400 }
        )
    }

    // Update issue
    const updateData: any = {}
    if (newWorkflowStateId) {
      updateData.workflowStateId = newWorkflowStateId
    }
    
    let newReviewerName: string | null = null
    if (newReviewerId !== undefined) {
      const reviewer = await db.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId: newReviewerId,
          },
        },
        select: { userName: true }
      })
      updateData.reviewerId = newReviewerId
      updateData.reviewer = reviewer?.userName || null
      newReviewerName = reviewer?.userName || null
    }

    const updatedIssue = await updateIssue(teamId, issueId, updateData, userId, userName)

    // Log specific review actions
    if (action === 'approve') {
      await db.issueActivity.create({
        data: {
          issueId,
          userId,
          userName,
          action: 'approved',
          metadata: { approvedBy: userName },
        },
      })
    } else if (action === 'send_back') {
      const targetState = workflowStates.find(s => s.id === newWorkflowStateId)
      await db.issueActivity.create({
        data: {
          issueId,
          userId,
          userName,
          action: 'sent_back',
          newValue: targetState?.name || 'previous state',
          metadata: reason ? { reason } : undefined,
        },
      })
    } else if (action === 'reassign' && newReviewerName) {
      await db.issueActivity.create({
        data: {
          issueId,
          userId,
          userName,
          action: 'reassigned',
          field: 'reviewer',
          newValue: newReviewerName,
          metadata: { newReviewerId },
        },
      })
    }

    return NextResponse.json({
      success: true,
      issue: updatedIssue,
      action
    })
  } catch (error: any) {
    console.error('Error performing review action:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to perform review action' },
      { status: 500 }
    )
  }
}


