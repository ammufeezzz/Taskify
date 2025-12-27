import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth-server-helpers'
import { db } from '@/lib/db'
import { updateIssue } from '@/lib/api/issues'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; issueId: string }> }
) {
  try {
    const { teamId, issueId } = await params
    const userId = await getUserId()
    const body = await request.json()
    const { action, targetStateId, reviewerId } = body

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

    if (teamMember.role !== 'owner' && teamMember.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Only Owners and Admins can perform review actions' },
        { status: 403 }
      )
    }

    // Get current issue
    const issue = await db.issue.findUnique({
      where: { id: issueId },
      select: {
        workflowStateId: true,
        workflowState: {
          select: { type: true }
        }
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
    }

    const updatedIssue = await updateIssue(teamId, issueId, updateData)

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


