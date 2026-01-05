import { NextRequest, NextResponse } from 'next/server'
import { updateLabel, deleteLabel } from '@/lib/api/labels'
import { CreateLabelData } from '@/lib/types'
import { getUserId, verifyTeamMembership } from '@/lib/auth-server-helpers'
import { getProjectById } from '@/lib/api/projects'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string; labelId: string }> }
) {
  try {
    const { teamId, projectId, labelId } = await params
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

    const updateData: Partial<CreateLabelData> = {
      name: body.name,
      color: body.color,
    }

    const label = await updateLabel(projectId, labelId, updateData)
    return NextResponse.json(label)
  } catch (error) {
    console.error('Error updating label:', error)
    return NextResponse.json(
      { error: 'Failed to update label' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; projectId: string; labelId: string }> }
) {
  try {
    const { teamId, projectId, labelId } = await params
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
    
    await deleteLabel(projectId, labelId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting label:', error)
    return NextResponse.json(
      { error: 'Failed to delete label' },
      { status: 500 }
    )
  }
}



