import { NextRequest, NextResponse } from 'next/server'
import { getLabels, createLabel, updateLabel, deleteLabel } from '@/lib/api/labels'
import { CreateLabelData } from '@/lib/types'
import { getUserId, verifyTeamMembership } from '@/lib/auth-server-helpers'
import { getProjectById } from '@/lib/api/projects'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const { teamId, projectId } = await params
    const userId = await getUserId()
    
    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)
    
    // Verify project exists and belongs to team
    const project = await getProjectById(teamId, projectId)
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }
    
    const labels = await getLabels(projectId)
    return NextResponse.json(labels)
  } catch (error) {
    console.error('Error fetching labels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch labels' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string }> }
) {
  try {
    const { teamId, projectId } = await params
    const body = await request.json()
    const userId = await getUserId()
    
    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)
    
    // Verify project exists and belongs to team
    const project = await getProjectById(teamId, projectId)
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const labelData: CreateLabelData = {
      name: body.name,
      color: body.color || '#64748b',
    }

    const label = await createLabel(projectId, labelData)
    return NextResponse.json(label, { status: 201 })
  } catch (error) {
    console.error('Error creating label:', error)
    return NextResponse.json(
      { error: 'Failed to create label' },
      { status: 500 }
    )
  }
}


