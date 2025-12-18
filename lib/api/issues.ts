import { db } from '@/lib/db'
import { CreateIssueData, UpdateIssueData, IssueFilters, IssueSort } from '@/lib/types'

export async function getIssues(
  teamId: string,
  filters: IssueFilters = {},
  sort: IssueSort = { field: 'createdAt', direction: 'desc' }
) {
  const where: any = {
    teamId,
  }

  // Collect AND conditions for complex filters
  const andConditions: any[] = []

  // Apply filters
  if (filters.status?.length) {
    where.workflowStateId = {
      in: filters.status,
    }
  }

  if (filters.assignee?.length) {
    // Filter by assignees - check both new relation AND legacy assigneeId field
    andConditions.push({
      OR: [
        // New many-to-many relation
        {
          assignees: {
            some: {
              userId: {
                in: filters.assignee,
              },
            },
          },
        },
        // Legacy single assignee field (for backward compatibility)
        {
          assigneeId: {
            in: filters.assignee,
          },
        },
      ],
    })
  }

  if (filters.project?.length) {
    where.projectId = {
      in: filters.project,
    }
  }

  if (filters.priority?.length) {
    where.priority = {
      in: filters.priority,
    }
  }

  if (filters.label?.length) {
    where.labels = {
      some: {
        labelId: {
          in: filters.label,
        },
      },
    }
  }

  if (filters.search) {
    andConditions.push({
      OR: [
        {
          title: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
      ],
    })
  }

  // Add AND conditions if any exist
  if (andConditions.length > 0) {
    where.AND = andConditions
  }

  const orderBy: any = {}
  orderBy[sort.field] = sort.direction

  return await db.issue.findMany({
    where,
    orderBy,
    select: {
      id: true,
      title: true,
      description: true,
      number: true,
      priority: true,
      dueDate: true,
      difficulty: true,
      estimate: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      teamId: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true,
          key: true,
          color: true,
        },
      },
      workflowStateId: true,
      workflowState: true,
      assigneeId: true,
      assignee: true,
      assignees: true, // Multiple assignees
      creatorId: true,
      creator: true,
      team: true,
      labels: {
        include: {
          label: true,
        },
      },
      comments: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })
}

export async function getIssueById(teamId: string, issueId: string) {
  return await db.issue.findFirst({
    where: {
      id: issueId,
      teamId,
    },
    select: {
      id: true,
      title: true,
      description: true,
      number: true,
      priority: true,
      dueDate: true,
      difficulty: true,
      estimate: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      teamId: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true,
          key: true,
          color: true,
        },
      },
      workflowStateId: true,
      workflowState: true,
      assigneeId: true,
      assignee: true,
      assignees: true, // Multiple assignees
      creatorId: true,
      creator: true,
      team: true,
      labels: {
        include: {
          label: true,
        },
      },
      comments: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })
}

export async function createIssue(teamId: string, data: CreateIssueData, creatorId: string, creatorName: string) {
  // Extract labelIds, assigneeIds, and projectId from data
  const { labelIds, projectId, assigneeIds, assigneeId, assignee, ...issueData } = data

  // Verify project if provided
  const project = projectId ? await db.project.findFirst({ where: { id: projectId, teamId }, select: { id: true } }) : null

  // Get assignee names from team members if assigneeIds provided
  let assigneeRecords: { userId: string; userName: string }[] = []
  if (assigneeIds?.length) {
    const teamMembers = await db.teamMember.findMany({
      where: {
        teamId,
        userId: { in: assigneeIds }
      },
      select: { userId: true, userName: true }
    })
    assigneeRecords = teamMembers.map(m => ({ userId: m.userId, userName: m.userName }))
  }

  // Prepare issue data (without number first, will be set in transaction)
  // Keep legacy assigneeId for backward compatibility (set to first assignee if multiple)
  const issueDataToCreate: any = {
    title: issueData.title,
    description: issueData.description,
    workflowStateId: issueData.workflowStateId,
    assigneeId: assigneeIds?.[0] || assigneeId || null,
    assignee: assigneeRecords[0]?.userName || assignee || null,
    priority: issueData.priority || 'none',
    estimate: issueData.estimate,
    dueDate: issueData.dueDate ? new Date(issueData.dueDate) : null,
    difficulty: issueData.difficulty,
    teamId,
    creatorId,
    creator: creatorName,
    ...(project && projectId ? { projectId } : {}),
  }

  // Create the issue with a select that includes all necessary relations
  // Exclude comments and reduce team data to improve performance
  const selectConfig = {
    id: true,
    title: true,
    description: true,
    number: true,
    priority: true,
    dueDate: true,
    difficulty: true,
    estimate: true,
    createdAt: true,
    updatedAt: true,
    completedAt: true,
    teamId: true,
    projectId: true,
    project: {
      select: {
        id: true,
        name: true,
        key: true,
        color: true,
      },
    },
    workflowStateId: true,
    workflowState: true,
    assigneeId: true,
    assignee: true,
    assignees: true, // Multiple assignees
    creatorId: true,
    creator: true,
    team: {
      select: {
        id: true,
        key: true,
      },
    },
    labels: {
      include: {
        label: true,
      },
    },
  }

  // Use transaction to generate number atomically and create issue, preventing race conditions
  return await db.$transaction(async (tx) => {
    // Optimized: Use aggregate to get max number (faster than findFirst with orderBy)
    const maxResult = await tx.issue.aggregate({
      where: { teamId },
      _max: { number: true },
    })

    const nextNumber = (maxResult._max.number || 0) + 1

    // Create issue with labels and assignees
    const issue = await tx.issue.create({
      data: {
        ...issueDataToCreate,
        number: nextNumber,
        ...(labelIds?.length ? {
          labels: {
            create: labelIds.map((labelId) => ({
              labelId,
            })),
          },
        } : {}),
        ...(assigneeRecords.length ? {
          assignees: {
            create: assigneeRecords.map(({ userId, userName }) => ({
              userId,
              userName,
            })),
          },
        } : {}),
      },
      select: selectConfig,
    })

    return issue
  })
}

export async function updateIssue(teamId: string, issueId: string, data: UpdateIssueData) {
  // Get current issue to check if project is changing
  const currentIssue = await db.issue.findUnique({
    where: { id: issueId },
    select: { projectId: true, number: true },
  })

  if (!currentIssue) {
    throw new Error('Issue not found')
  }

  // Handle project change - renumber the issue if project is being changed
  if (data.projectId !== undefined && data.projectId !== currentIssue.projectId) {
    // Get the last issue number for the entire team (not per project)
    const lastIssue = await db.issue.findFirst({
      where: { teamId },
      orderBy: { number: 'desc' },
      select: { number: true },
    })

    const nextNumber = (lastIssue?.number || 0) + 1
    data.number = nextNumber
  }

  // Handle labels separately (before updating the issue)
  if (data.labelIds !== undefined) {
    // Remove existing labels
    await db.issueLabel.deleteMany({
      where: { issueId },
    })

    // Add new labels if any
    if (data.labelIds.length > 0) {
      await db.issueLabel.createMany({
        data: data.labelIds.map((labelId) => ({
          issueId,
          labelId,
        })),
      })
    }
  }

  // Handle multiple assignees
  if (data.assigneeIds !== undefined) {
    // Remove existing assignees
    await db.issueAssignee.deleteMany({
      where: { issueId },
    })

    // Add new assignees if any
    if (data.assigneeIds.length > 0) {
      // Get assignee names from team members
      const teamMembers = await db.teamMember.findMany({
        where: {
          teamId,
          userId: { in: data.assigneeIds }
        },
        select: { userId: true, userName: true }
      })

      await db.issueAssignee.createMany({
        data: teamMembers.map(m => ({
          issueId,
          userId: m.userId,
          userName: m.userName,
        })),
      })

      // Also update legacy single assignee fields (first assignee)
      const firstAssignee = teamMembers[0]
      if (firstAssignee) {
        data.assigneeId = firstAssignee.userId
        data.assignee = firstAssignee.userName
      } else {
        data.assigneeId = null
        data.assignee = null
      }
    } else {
      // Clear legacy assignee fields
      data.assigneeId = null
      data.assignee = null
    }
  }

  // Build update data object, only including fields that are defined
  // Exclude labelIds, assigneeIds and number (handled separately)
  const { labelIds, assigneeIds, number, ...updateFields } = data

  // Only include fields that are actually being updated
  const updateData: any = {}

  if ('title' in updateFields && updateFields.title !== undefined) {
    updateData.title = updateFields.title
  }
  if ('description' in updateFields && updateFields.description !== undefined) {
    updateData.description = updateFields.description
  }
  if ('projectId' in updateFields && updateFields.projectId !== undefined) {
    updateData.projectId = updateFields.projectId
  }
  if ('workflowStateId' in updateFields && updateFields.workflowStateId !== undefined) {
    updateData.workflowStateId = updateFields.workflowStateId
    
    // Check if the new workflow state is a "completed" type and set completedAt accordingly
    const newWorkflowState = await db.workflowState.findUnique({
      where: { id: updateFields.workflowStateId },
      select: { type: true }
    })
    
    if (newWorkflowState?.type === 'completed') {
      // Set completedAt to now when moving to a completed state
      updateData.completedAt = new Date()
    } else {
      // Clear completedAt when moving away from completed state
      updateData.completedAt = null
    }
  }
  if ('assigneeId' in updateFields && updateFields.assigneeId !== undefined) {
    updateData.assigneeId = updateFields.assigneeId
  }
  if ('assignee' in updateFields && updateFields.assignee !== undefined) {
    updateData.assignee = updateFields.assignee
  }
  if ('priority' in updateFields && updateFields.priority !== undefined) {
    updateData.priority = updateFields.priority
  }
  if ('estimate' in updateFields && updateFields.estimate !== undefined) {
    updateData.estimate = updateFields.estimate
  }
  if ('dueDate' in updateFields && updateFields.dueDate !== undefined) {
    updateData.dueDate = updateFields.dueDate ? new Date(updateFields.dueDate) : null
  }
  if ('difficulty' in updateFields && updateFields.difficulty !== undefined) {
    updateData.difficulty = updateFields.difficulty
  }
  if ('number' in data && data.number !== undefined) {
    updateData.number = data.number
  }

  const updatedIssue = await db.issue.update({
    where: {
      id: issueId,
      teamId,
    },
    data: updateData,
    select: {
      id: true,
      title: true,
      description: true,
      number: true,
      priority: true,
      dueDate: true,
      difficulty: true,
      estimate: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      teamId: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true,
          key: true,
          color: true,
        },
      },
      workflowStateId: true,
      workflowState: true,
      assigneeId: true,
      assignee: true,
      assignees: true, // Multiple assignees
      creatorId: true,
      creator: true,
      team: true,
      labels: {
        include: {
          label: true,
        },
      },
      comments: {
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  })

  return updatedIssue
}

export async function deleteIssue(teamId: string, issueId: string) {
  return await db.issue.delete({
    where: {
      id: issueId,
      teamId,
    },
  })
}

export async function getIssueStats(teamId: string) {
  const [total, byStatus, byPriority, byAssignee] = await Promise.all([
    db.issue.count({
      where: { teamId },
    }),
    db.issue.groupBy({
      by: ['workflowStateId'],
      where: { teamId },
      _count: true,
    }),
    db.issue.groupBy({
      by: ['priority'],
      where: { teamId },
      _count: true,
    }),
    db.issue.groupBy({
      by: ['assigneeId'],
      where: {
        teamId,
        assigneeId: { not: null },
      },
      _count: true,
    }),
  ])

  return {
    total,
    byStatus,
    byPriority,
    byAssignee,
  }
}
