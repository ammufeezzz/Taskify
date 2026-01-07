'use server'

import { revalidatePath } from 'next/cache'
import { createProject as createProjectLib, updateProject as updateProjectLib, deleteProject as deleteProjectLib, getProjectById } from '@/lib/api/projects'
import { createLabel } from '@/lib/api/labels'
import { CreateProjectData, UpdateProjectData } from '@/lib/types'
import { getUserId, getUser, verifyTeamMembership } from '@/lib/auth-server-helpers'
import { db } from '@/lib/db'

export async function createProjectAction(teamId: string, data: CreateProjectData) {
  try {
    // Get the current user from Better Auth (parallel calls)
    const [authResult, userResult] = await Promise.all([
      getUserId(),
      getUser()
    ])
    
    const userId = authResult
    const user = userResult

    // Verify user is a team member
    await verifyTeamMembership(teamId, userId)

    // Get user display name
    const userName = user.name || user.email || 'Unknown'

    // Look up lead name from TeamMember if leadId is provided
    let leadName: string | undefined = userName // default to current user
    const actualLeadId = data.leadId || userId
    
    if (actualLeadId) {
      const teamMember = await db.teamMember.findFirst({
        where: {
          teamId,
          userId: actualLeadId
        }
      })
      
      if (teamMember) {
        leadName = teamMember.userName
      } else if (actualLeadId === userId) {
        leadName = userName
      }
    }

    const projectData: CreateProjectData = {
      name: data.name,
      description: data.description,
      key: data.key,
      color: data.color || '#6366f1',
      icon: data.icon,
      leadId: actualLeadId,
      lead: leadName,
    }

    const project = await createProjectLib(teamId, projectData)
    
    // Revalidate the projects page
    revalidatePath(`/dashboard/${teamId}/projects`)
    
    return { success: true, project }
  } catch (error) {
    console.error('Error creating project:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create project' 
    }
  }
}

export async function updateProjectAction(teamId: string, projectId: string, data: UpdateProjectData) {
  try {
    const userId = await getUserId()
    await verifyTeamMembership(teamId, userId)

    // Handle lead name lookup if lead is being updated
    if (data.leadId !== undefined) {
      const user = await getUser()
      const userName = user.name || user.email || 'Unknown'
      
      let leadName: string | undefined = userName
      const actualLeadId = data.leadId || userId
      
      if (actualLeadId) {
        const teamMember = await db.teamMember.findFirst({
          where: {
            teamId,
            userId: actualLeadId
          }
        })
        
        if (teamMember) {
          leadName = teamMember.userName
        } else if (actualLeadId === userId) {
          leadName = userName
        }
      }
      
      data.lead = leadName
      data.leadId = actualLeadId
    }

    const project = await updateProjectLib(teamId, projectId, data)
    
    // Revalidate the projects page
    revalidatePath(`/dashboard/${teamId}/projects`)
    
    return { success: true, project }
  } catch (error) {
    console.error('Error updating project:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update project' 
    }
  }
}

export async function deleteProjectAction(teamId: string, projectId: string) {
  try {
    const userId = await getUserId()
    await verifyTeamMembership(teamId, userId)

    await deleteProjectLib(teamId, projectId)
    
    // Revalidate the projects page
    revalidatePath(`/dashboard/${teamId}/projects`)
    
    return { success: true }
  } catch (error) {
    console.error('Error deleting project:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete project' 
    }
  }
}

export async function duplicateProjectAction(teamId: string, projectId: string) {
  try {
    const userId = await getUserId()
    const user = await getUser()
    await verifyTeamMembership(teamId, userId)

    const userName = user.name || user.email || 'Unknown'

    // Get the original project with all its issues and labels
    const originalProject = await getProjectById(teamId, projectId)
    if (!originalProject) {
      return { 
        success: false, 
        error: 'Project not found' 
      }
    }

    // Get all labels from the original project
    const originalLabels = await db.label.findMany({
      where: { projectId: originalProject.id }
    })

    // Create duplicate project
    const duplicateData: CreateProjectData = {
      name: `${originalProject.name} (Copy)`,
      description: originalProject.description ?? undefined,
      key: `${originalProject.key}-COPY`,
      color: originalProject.color,
      icon: originalProject.icon ?? undefined,
      leadId: originalProject.leadId ?? undefined,
    }

    // Get lead name if leadId exists
    let leadName: string | undefined = userName
    if (duplicateData.leadId) {
      const teamMember = await db.teamMember.findFirst({
        where: {
          teamId,
          userId: duplicateData.leadId
        }
      })
      
      if (teamMember) {
        leadName = teamMember.userName
      } else if (duplicateData.leadId === userId) {
        leadName = userName
      }
    }
    duplicateData.lead = leadName

    const newProject = await createProjectLib(teamId, duplicateData)

    // Create label mapping (old label ID -> new label ID)
    const labelMap = new Map<string, string>()
    for (const originalLabel of originalLabels) {
      const newLabel = await createLabel(newProject.id, {
        name: originalLabel.name,
        color: originalLabel.color,
      })
      labelMap.set(originalLabel.id, newLabel.id)
    }

    // Get all issues from the original project with full details
    const originalIssues = await db.issue.findMany({
      where: {
        projectId: originalProject.id,
        teamId,
      },
      include: {
        labels: {
          include: {
            label: true,
          },
        },
        assignees: true,
        workflowState: true,
      },
      orderBy: {
        createdAt: 'asc', // Process in creation order to maintain parent-child relationships
      },
    })

    // Create a map to track old issue ID -> new issue ID for parent-child relationships
    const issueMap = new Map<string, string>()

    // Separate parent issues (no parentId) and child issues (has parentId)
    const parentIssues = originalIssues.filter(issue => !issue.parentId)
    const childIssues = originalIssues.filter(issue => issue.parentId)

    // Get team members for assignee name lookup
    const teamMembers = await db.teamMember.findMany({
      where: { teamId },
      select: { userId: true, userName: true }
    })
    const teamMemberMap = new Map(teamMembers.map(m => [m.userId, m.userName]))

    // Create all issues in a single transaction with increased timeout (30 seconds)
    // This is much more efficient than creating them one by one
    await db.$transaction(async (tx) => {
      // Get the max issue number for the team
      const maxResult = await tx.issue.aggregate({
        where: { teamId },
        _max: { number: true },
      })
      let nextNumber = (maxResult._max.number || 0) + 1

      // First, create all parent issues
      for (const originalIssue of parentIssues) {
        // Skip if required fields are missing
        if (!originalIssue.workflowStateId || !originalIssue.difficulty) {
          console.warn(`Skipping issue ${originalIssue.id} - missing required fields`)
          continue
        }

        // Map label IDs from old to new
        const newLabelIds = originalIssue.labels
          .map(il => labelMap.get(il.labelId))
          .filter((id): id is string => id !== undefined)

        // Get assignee IDs and names - if none, use current user as default
        let assigneeIds = originalIssue.assignees.map(a => a.userId)
        if (assigneeIds.length === 0 && originalIssue.assigneeId) {
          assigneeIds = [originalIssue.assigneeId]
        }
        if (assigneeIds.length === 0) {
          assigneeIds = [userId] // Default to current user if no assignees
        }
        const assigneeRecords = assigneeIds.map(id => ({
          userId: id,
          userName: teamMemberMap.get(id) || userName
        }))

        // Create the issue directly in the transaction
        const newIssue = await tx.issue.create({
          data: {
            title: originalIssue.title,
            description: originalIssue.description,
            number: nextNumber++,
            priority: originalIssue.priority || 'none',
            estimate: originalIssue.estimate,
            dueDate: originalIssue.dueDate || new Date(),
            difficulty: originalIssue.difficulty,
            teamId,
            projectId: newProject.id,
            workflowStateId: originalIssue.workflowStateId,
            assigneeId: assigneeIds[0] || userId,
            assignee: assigneeRecords[0]?.userName || userName,
            creatorId: userId,
            creator: userName,
            ...(newLabelIds.length > 0 ? {
              labels: {
                create: newLabelIds.map((labelId) => ({ labelId })),
              },
            } : {}),
            ...(assigneeRecords.length > 0 ? {
              assignees: {
                create: assigneeRecords,
              },
            } : {}),
          },
        })

        // Log issue creation activity
        await tx.issueActivity.create({
          data: {
            issueId: newIssue.id,
            userId,
            userName,
            action: 'created',
            metadata: { title: newIssue.title },
          },
        })

        issueMap.set(originalIssue.id, newIssue.id)
      }

      // Then, create all child issues with mapped parent IDs
      for (const originalIssue of childIssues) {
        const newParentId = originalIssue.parentId ? issueMap.get(originalIssue.parentId) : undefined
        
        // Skip if parent wasn't found
        if (!newParentId || !originalIssue.workflowStateId || !originalIssue.difficulty) {
          console.warn(`Skipping child issue ${originalIssue.id} - parent not found or missing required fields`)
          continue
        }

        // Map label IDs from old to new
        const newLabelIds = originalIssue.labels
          .map(il => labelMap.get(il.labelId))
          .filter((id): id is string => id !== undefined)

        // Get assignee IDs and names - if none, use current user as default
        let assigneeIds = originalIssue.assignees.map(a => a.userId)
        if (assigneeIds.length === 0 && originalIssue.assigneeId) {
          assigneeIds = [originalIssue.assigneeId]
        }
        if (assigneeIds.length === 0) {
          assigneeIds = [userId]
        }
        const assigneeRecords = assigneeIds.map(id => ({
          userId: id,
          userName: teamMemberMap.get(id) || userName
        }))

        // Create the issue directly in the transaction
        const newIssue = await tx.issue.create({
          data: {
            title: originalIssue.title,
            description: originalIssue.description,
            number: nextNumber++,
            priority: originalIssue.priority || 'none',
            estimate: originalIssue.estimate,
            dueDate: originalIssue.dueDate || new Date(),
            difficulty: originalIssue.difficulty,
            teamId,
            projectId: newProject.id,
            workflowStateId: originalIssue.workflowStateId,
            parentId: newParentId,
            assigneeId: assigneeIds[0] || userId,
            assignee: assigneeRecords[0]?.userName || userName,
            creatorId: userId,
            creator: userName,
            ...(newLabelIds.length > 0 ? {
              labels: {
                create: newLabelIds.map((labelId) => ({ labelId })),
              },
            } : {}),
            ...(assigneeRecords.length > 0 ? {
              assignees: {
                create: assigneeRecords,
              },
            } : {}),
          },
        })

        // Log issue creation activity
        await tx.issueActivity.create({
          data: {
            issueId: newIssue.id,
            userId,
            userName,
            action: 'created',
            metadata: { title: newIssue.title },
          },
        })

        issueMap.set(originalIssue.id, newIssue.id)
      }
    }, {
      timeout: 30000, // 30 second timeout for large projects
    })

    // Revalidate the projects and issues pages
    revalidatePath(`/dashboard/${teamId}/projects`)
    revalidatePath(`/dashboard/${teamId}/issues`)
    
    return { success: true, project: newProject }
  } catch (error) {
    console.error('Error duplicating project:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to duplicate project' 
    }
  }
}

