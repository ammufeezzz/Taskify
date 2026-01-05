import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/auth-server-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params

    // Get the current user from Better Auth
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if team already exists in local database
    const existingTeam = await db.team.findUnique({
      where: { id: teamId }
    })

    if (existingTeam) {
      return NextResponse.json(existingTeam)
    }

    // Get team name from request body or default
    const body = await request.json().catch(() => ({}))
    const teamName = body.name || `Team ${teamId.substring(0, 8)}`

    // Create team in local database
    const localTeam = await db.team.create({
      data: {
        id: teamId,
        name: teamName,
        key: teamName.substring(0, 3).toUpperCase(),
      }
    })

    // Create default workflow states for the team
    const defaultWorkflowStates = [
      { name: 'Backlog', type: 'backlog', color: '#64748b', position: 0 },
      { name: 'Todo', type: 'unstarted', color: '#3b82f6', position: 1 },
      { name: 'In Progress', type: 'started', color: '#f59e0b', position: 2 },
      { name: 'Review', type: 'review', color: '#f59e0b', position: 3 },
      { name: 'Done', type: 'completed', color: '#10b981', position: 4 },
    ]

    await Promise.all(
      defaultWorkflowStates.map(state =>
        db.workflowState.create({
          data: {
            ...state,
            teamId: teamId,
          }
        })
      )
    )

    // Labels are now project-specific, so no default labels are created at team level
    // Users will create labels per project as needed

    return NextResponse.json(localTeam, { status: 201 })
  } catch (error) {
    console.error('Error syncing team:', error)
    return NextResponse.json(
      { error: 'Failed to sync team' },
      { status: 500 }
    )
  }
}
