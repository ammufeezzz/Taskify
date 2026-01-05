import { NextRequest, NextResponse } from 'next/server'
import { getUserId, verifyTeamMembership } from '@/lib/auth-server-helpers'
import { getIssueActivities } from '@/lib/api/activity'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; issueId: string }> }
) {
  try {
    const { teamId, issueId } = await params
    const userId = await getUserId()

    // Verify team membership
    await verifyTeamMembership(teamId, userId)

    // Verify issue exists and belongs to team
    const issue = await db.issue.findFirst({
      where: { id: issueId, teamId },
      select: { id: true },
    })

    if (!issue) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      )
    }

    // Parse pagination params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const cursor = searchParams.get('cursor') || undefined

    const activities = await getIssueActivities(issueId, { limit, cursor })

    return NextResponse.json(activities)
  } catch (error) {
    console.error('Error fetching issue activities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}


