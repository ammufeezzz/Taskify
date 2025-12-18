import { NextRequest, NextResponse } from 'next/server'
import { getIssues, createIssue, getIssueStats } from '@/lib/api/issues'
import { CreateIssueData } from '@/lib/types'
import { getUserId, getUser, verifyTeamMembership } from "@/lib/auth-server-helpers"
import { db } from '@/lib/db'

// Cache for team existence checks
const teamExistsCache = new Set<string>()

// Helper function to ensure team exists in local database
async function ensureTeamExists(teamId: string) {
  // Check cache first
  if (teamExistsCache.has(teamId)) {
    return { id: teamId }
  }

  const localTeam = await db.team.findUnique({
    where: { id: teamId }
  })

  if (!localTeam) {
    throw new Error('Team not found')
  }

  // Cache the team existence
  teamExistsCache.add(teamId)
  return localTeam
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const { teamId } = await params
    const userId = await getUserId()

    // Ensure team exists and user is a member
    await ensureTeamExists(teamId)
    await verifyTeamMembership(teamId, userId)

    // Parse filters from query params
    const filters = {
      status: searchParams.getAll('status'),
      assignee: searchParams.getAll('assignee'),
      project: searchParams.getAll('project'),
      label: searchParams.getAll('label'),
      priority: searchParams.getAll('priority'),
      search: searchParams.get('search') || undefined,
    }

    // Parse sort from query params
    const sortField = searchParams.get('sortField') || 'createdAt'
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc'
    const sort = { field: sortField as any, direction: sortDirection }

    // Check if requesting stats
    if (searchParams.get('stats') === 'true') {
      const stats = await getIssueStats(teamId)
      return NextResponse.json(stats)
    }

    const issues = await getIssues(teamId, filters, sort)
    return NextResponse.json(issues)
  } catch (error) {
    console.error('Error fetching issues:', error)
    return NextResponse.json(
      { error: 'Failed to fetch issues' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const body = await request.json()

    // Normalize assigneeIds - support both old single assigneeId and new assigneeIds array
    let assigneeIds: string[] = []
    if (body.assigneeIds && Array.isArray(body.assigneeIds)) {
      assigneeIds = body.assigneeIds.filter((id: string) => id && id !== 'unassigned')
    } else if (body.assigneeId && body.assigneeId !== 'unassigned') {
      assigneeIds = [body.assigneeId]
    }

    // Validate mandatory fields for issue creation
    const validationErrors: string[] = []
    
    if (!body.title || body.title.trim() === '') {
      validationErrors.push('Title is required')
    }
    if (!body.workflowStateId || body.workflowStateId.trim() === '') {
      validationErrors.push('Stage is required')
    }
    if (assigneeIds.length === 0) {
      validationErrors.push('At least one assignee is required')
    }
    if (!body.dueDate || body.dueDate.trim() === '') {
      validationErrors.push('Due date is required')
    }
    if (!body.labelIds || !Array.isArray(body.labelIds) || body.labelIds.length === 0) {
      validationErrors.push('At least one tag is required')
    }
    if (!body.difficulty || !['S', 'M', 'L'].includes(body.difficulty)) {
      validationErrors.push('Estimated size (S/M/L) is required')
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors[0], errors: validationErrors },
        { status: 400 }
      )
    }

    // Get user info from Better Auth (parallel calls for speed)
    const [userId, user] = await Promise.all([
      getUserId(),
      getUser(),
      ensureTeamExists(teamId)
    ])

    // Get creator name early
    const creatorName = user.name || user.email || 'Unknown'

    // Verify team membership
    await verifyTeamMembership(teamId, userId)

    const issueData: CreateIssueData = {
      title: body.title,
      description: body.description,
      projectId: body.projectId && body.projectId.trim() !== '' ? body.projectId : undefined,
      workflowStateId: body.workflowStateId,
      assigneeIds, // Multiple assignees
      priority: body.priority || 'none',
      estimate: body.estimate,
      labelIds: body.labelIds,
      dueDate: body.dueDate,
      difficulty: body.difficulty,
    }

    const issue = await createIssue(
      teamId,
      issueData,
      userId,
      creatorName
    )
    return NextResponse.json(issue, { status: 201 })
  } catch (error) {
    console.error('Error creating issue:', error)
    return NextResponse.json(
      { error: 'Failed to create issue' },
      { status: 500 }
    )
  }
}
