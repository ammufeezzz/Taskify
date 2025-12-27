import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId, verifyTeamMembership } from '@/lib/auth-server-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const userId = await getUserId()
    
    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)

    // Check if Review state already exists
    const existingReview = await db.workflowState.findFirst({
      where: {
        teamId,
        type: 'review'
      }
    })

    if (existingReview) {
      return NextResponse.json({ 
        message: 'Review state already exists',
        state: existingReview 
      })
    }

    // Get the current Done state to determine position
    const doneState = await db.workflowState.findFirst({
      where: {
        teamId,
        type: 'completed'
      }
    })

    // Create Review state (position 3, or before Done if Done exists)
    const reviewState = await db.workflowState.create({
      data: {
        name: 'Review',
        type: 'review',
        color: '#f59e0b',
        position: doneState ? doneState.position : 3,
        teamId,
      }
    })

    // If Done state exists, update its position to be after Review
    if (doneState) {
      await db.workflowState.update({
        where: { id: doneState.id },
        data: { position: reviewState.position + 1 }
      })
    }

    return NextResponse.json({ 
      message: 'Review state added successfully',
      state: reviewState 
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error adding Review state:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add Review state' },
      { status: 500 }
    )
  }
}


