import { db } from '@/lib/db'
import { CreateIssueData, UpdateIssueData, IssueFilters, IssueSort } from '@/lib/types'
import { logIssueCreated, logFieldUpdate, logStatusChange, logAssignment } from './activity'

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
      reviewedAt: true,
      reviewerId: true,
      reviewer: true,
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
      // Parent-child relationship
      parentId: true,
      parent: {
        select: {
          id: true,
          title: true,
          number: true,
          workflowStateId: true,
          workflowState: true,
          assignee: true,
          assignees: true,
          dueDate: true,
          priority: true,
        },
      },
      children: {
        select: {
          id: true,
          title: true,
          number: true,
          workflowStateId: true,
          workflowState: true,
          assignee: true,
          assignees: true,
          dueDate: true,
          priority: true,
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
      reviewedAt: true,
      reviewerId: true,
      reviewer: true,
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
      // Parent-child relationship
      parentId: true,
      parent: {
        select: {
          id: true,
          title: true,
          number: true,
          workflowStateId: true,
          workflowState: true,
          assignee: true,
          assignees: true,
          dueDate: true,
          priority: true,
        },
      },
      children: {
        select: {
          id: true,
          title: true,
          number: true,
          workflowStateId: true,
          workflowState: true,
          assignee: true,
          assignees: true,
          dueDate: true,
          priority: true,
        },
      },
    },
  })
}

export async function createIssue(teamId: string, data: CreateIssueData, creatorId: string, creatorName: string) {
  // Extract labelIds, assigneeIds, projectId, and parentId from data
  const { labelIds, projectId, assigneeIds, assigneeId, assignee, parentId, ...issueData } = data

  // Verify parent issue if provided
  let parentIssue = null
  let inheritedLabelIds: string[] = []
  
  if (parentId) {
    parentIssue = await db.issue.findFirst({
      where: { id: parentId, teamId },
      select: {
        id: true,
        projectId: true,
        labels: {
          select: { labelId: true },
        },
      },
    })
    
    if (!parentIssue) {
      throw new Error('Parent issue not found')
    }
    
    // Inherit parent's labels (sub-issue gets same labels by default)
    inheritedLabelIds = parentIssue.labels.map(l => l.labelId)
  }

  // Determine effective projectId (use parent's project if creating sub-issue without explicit project)
  const effectiveProjectId = projectId || parentIssue?.projectId || null

  // Verify project if provided
  const project = effectiveProjectId ? await db.project.findFirst({ where: { id: effectiveProjectId, teamId }, select: { id: true } }) : null

  // Merge provided labels with inherited labels (provided labels take precedence / add to inherited)
  const finalLabelIds = [...new Set([...inheritedLabelIds, ...(labelIds || [])])]

  // Validate labels belong to the project (if projectId is provided)
  if (finalLabelIds?.length && effectiveProjectId) {
    const validLabels = await db.label.findMany({
      where: {
        id: { in: finalLabelIds },
        projectId: effectiveProjectId,
      },
      select: { id: true },
    })
    
    if (validLabels.length !== finalLabelIds.length) {
      throw new Error('One or more labels do not belong to the specified project')
    }
  } else if (finalLabelIds?.length && !effectiveProjectId) {
    // If issue has no project, labels cannot be assigned (labels are now project-specific)
    throw new Error('Labels can only be assigned to issues that belong to a project')
  }

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
    ...(project && effectiveProjectId ? { projectId: effectiveProjectId } : {}),
    ...(parentId ? { parentId } : {}),
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
    reviewedAt: true,
    reviewerId: true,
    reviewer: true,
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
    // Parent-child relationship
    parentId: true,
    parent: {
      select: {
        id: true,
        title: true,
        number: true,
        workflowStateId: true,
        workflowState: true,
        assignee: true,
        assignees: true,
        dueDate: true,
        priority: true,
      },
    },
    children: {
      select: {
        id: true,
        title: true,
        number: true,
        workflowStateId: true,
        workflowState: true,
        assignee: true,
        assignees: true,
        dueDate: true,
        priority: true,
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
        ...(finalLabelIds?.length ? {
          labels: {
            create: finalLabelIds.map((labelId) => ({
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

    // Log issue creation activity
    await tx.issueActivity.create({
      data: {
        issueId: issue.id,
        userId: creatorId,
        userName: creatorName,
        action: 'created',
        metadata: { title: issue.title },
      },
    })

    return issue
  })
}

export async function updateIssue(teamId: string, issueId: string, data: UpdateIssueData, userId?: string, userName?: string) {
  // Get current issue with all fields for change tracking
  const currentIssue = await db.issue.findUnique({
    where: { id: issueId },
    select: {
      projectId: true,
      number: true,
      title: true,
      description: true,
      workflowStateId: true,
      priority: true,
      dueDate: true,
      difficulty: true,
      parentId: true,
      assignees: { select: { userId: true, userName: true } },
      workflowState: { select: { name: true, type: true } },
    },
  })

  if (!currentIssue) {
    throw new Error('Issue not found')
  }

  // 🔒 REVIEW LOCK: When issue is in Review, only allow specific changes
  if (currentIssue.workflowState?.type === 'review') {
    const allowedFields = ['workflowStateId', 'reviewerId', 'reviewer']
    const attemptedFields = Object.keys(data).filter(key => {
      const value = data[key as keyof UpdateIssueData]
      return value !== undefined
    })
    
    const disallowedFields = attemptedFields.filter(field => !allowedFields.includes(field))
    
    if (disallowedFields.length > 0) {
      throw new Error('This issue is locked for review. Only the reviewer can perform review actions.')
    }
  }
  
  // Store old values for activity logging
  const oldValues = {
    title: currentIssue.title,
    description: currentIssue.description,
    workflowStateId: currentIssue.workflowStateId,
    workflowStateName: currentIssue.workflowState?.name,
    workflowStateType: currentIssue.workflowState?.type,
    priority: currentIssue.priority,
    dueDate: currentIssue.dueDate?.toISOString().slice(0, 10),
    difficulty: currentIssue.difficulty,
    parentId: currentIssue.parentId,
    assignees: currentIssue.assignees.map(a => a.userName).join(', '),
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
    // Determine the project ID (use new projectId if being changed, otherwise current issue's projectId)
    const targetProjectId = data.projectId !== undefined ? data.projectId : currentIssue.projectId
    
    // Validate labels belong to the project
    if (data.labelIds.length > 0) {
      if (!targetProjectId) {
        throw new Error('Labels can only be assigned to issues that belong to a project')
      }
      
      const validLabels = await db.label.findMany({
        where: {
          id: { in: data.labelIds },
          projectId: targetProjectId,
        },
        select: { id: true },
      })
      
      if (validLabels.length !== data.labelIds.length) {
        throw new Error('One or more labels do not belong to the specified project')
      }
    }
    
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
  // Exclude labelIds, assigneeIds, number, and parentId (handled separately)
  const { labelIds, assigneeIds, number, parentId, ...updateFields } = data

  // Only include fields that are actually being updated
  const updateData: any = {}
  
  // Handle parentId - prevent circular references
  if ('parentId' in data) {
    if (data.parentId) {
      // Validate parent exists and is not the same issue or a descendant
      const parentIssue = await db.issue.findFirst({
        where: { id: data.parentId, teamId },
        select: { id: true, parentId: true },
      })
      
      if (!parentIssue) {
        throw new Error('Parent issue not found')
      }
      
      if (parentIssue.id === issueId) {
        throw new Error('An issue cannot be its own parent')
      }
      
      // Check for circular reference - ensure this issue is not an ancestor of the parent
      let currentParentId = parentIssue.parentId
      const visited = new Set([issueId])
      
      while (currentParentId) {
        if (visited.has(currentParentId)) {
          throw new Error('Circular reference detected: cannot set parent')
        }
        visited.add(currentParentId)
        
        const ancestor = await db.issue.findFirst({
          where: { id: currentParentId, teamId },
          select: { parentId: true },
        })
        currentParentId = ancestor?.parentId || null
      }
      
      // Check descendants - ensure parent is not a descendant of this issue
      const checkDescendants = async (id: string): Promise<boolean> => {
        const children = await db.issue.findMany({
          where: { parentId: id, teamId },
          select: { id: true },
        })
        
        for (const child of children) {
          if (child.id === data.parentId) return true
          if (await checkDescendants(child.id)) return true
        }
        return false
      }
      
      if (await checkDescendants(issueId)) {
        throw new Error('Circular reference detected: parent issue is a descendant of this issue')
      }
      
      updateData.parentId = data.parentId
    } else {
      // Clear parent (set to null)
      updateData.parentId = null
    }
  }

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
    // Get current workflow state to check transition rules
    const currentIssue = await db.issue.findUnique({
      where: { id: issueId },
      select: { workflowStateId: true }
    })
    
    const currentWorkflowState = currentIssue ? await db.workflowState.findUnique({
      where: { id: currentIssue.workflowStateId },
      select: { type: true }
    }) : null
    
    const newWorkflowState = await db.workflowState.findUnique({
      where: { id: updateFields.workflowStateId },
      select: { type: true }
    })
    
    // 🔒 HARD RULE: Block direct transitions to Done from any state except Review
    if (newWorkflowState?.type === 'completed' && currentWorkflowState?.type !== 'review') {
      throw new Error('Cannot move to Done from any stage except Review. Please move the issue to Review first.')
    }
    
    // Set reviewedAt and handle reviewer when moving to Review stage
    if (newWorkflowState?.type === 'review' && currentWorkflowState?.type !== 'review') {
      updateData.reviewedAt = new Date()
      
      // Check if reviewerId was provided by the user
      if ('reviewerId' in data && data.reviewerId) {
        // Validate reviewer is not one of the assignees (can't review own work)
        const assigneeIds = currentIssue?.assignees?.map(a => a.userId) || []
        if (assigneeIds.includes(data.reviewerId)) {
          throw new Error('Reviewer cannot be one of the assignees. Please select a different reviewer.')
        }
        
        // Verify reviewer is a team member
        const reviewerMember = await db.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId,
              userId: data.reviewerId,
            },
          },
          select: { userId: true, userName: true }
        })
        
        if (!reviewerMember) {
          throw new Error('Selected reviewer is not a member of this team.')
        }
        
        updateData.reviewerId = reviewerMember.userId
        updateData.reviewer = data.reviewer || reviewerMember.userName
      } else {
        // No reviewer provided - require one to be selected
        throw new Error('Please select a reviewer before moving to Review stage.')
      }
    }
    
    // Clear reviewer when moving away from Review
    if (newWorkflowState?.type !== 'review' && currentWorkflowState?.type === 'review') {
      updateData.reviewerId = null
      updateData.reviewer = null
    }
    
    // Set completedAt when moving to completed state
    if (newWorkflowState?.type === 'completed') {
      updateData.completedAt = new Date()
    } else {
      // Clear completedAt when moving away from completed state
      updateData.completedAt = null
    }
    
    updateData.workflowStateId = updateFields.workflowStateId
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
      reviewedAt: true,
      reviewerId: true,
      reviewer: true,
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
      // Parent-child relationship
      parentId: true,
      parent: {
        select: {
          id: true,
          title: true,
          number: true,
          workflowStateId: true,
          workflowState: true,
          assignee: true,
          assignees: true,
          dueDate: true,
          priority: true,
        },
      },
      children: {
        select: {
          id: true,
          title: true,
          number: true,
          workflowStateId: true,
          workflowState: true,
          assignee: true,
          assignees: true,
          dueDate: true,
          priority: true,
        },
      },
    },
  })

  // Log activities if user info is provided
  if (userId && userName) {
    const activities: Promise<any>[] = []

    // Log status change
    if (data.workflowStateId && data.workflowStateId !== oldValues.workflowStateId) {
      const newStateName = updatedIssue.workflowState?.name || data.workflowStateId
      const newStateType = updatedIssue.workflowState?.type
      
      // Determine the specific action
      let action = 'status_changed'
      if (newStateType === 'review' && oldValues.workflowStateType !== 'review') {
        action = 'sent_to_review'
      } else if (newStateType === 'completed' && oldValues.workflowStateType === 'review') {
        action = 'approved'
      }
      
      // Build metadata - include reviewer info when sending to review
      const metadata: any = {
        oldStatusId: oldValues.workflowStateId,
        newStatusId: data.workflowStateId,
      }
      
      // Add reviewer info when sending to review
      if (action === 'sent_to_review' && data.reviewerId) {
        metadata.reviewerId = data.reviewerId
        metadata.reviewerName = data.reviewer || updatedIssue.reviewer
      }
      
      activities.push(
        db.issueActivity.create({
          data: {
            issueId,
            userId,
            userName,
            action,
            field: 'workflowStateId',
            oldValue: oldValues.workflowStateName || oldValues.workflowStateId,
            newValue: action === 'sent_to_review' && data.reviewer 
              ? `Review (Reviewer: ${data.reviewer})` 
              : newStateName,
            metadata,
          },
        })
      )
    }

    // Log title change
    if (data.title && data.title !== oldValues.title) {
      activities.push(
        db.issueActivity.create({
          data: {
            issueId,
            userId,
            userName,
            action: 'updated',
            field: 'title',
            oldValue: oldValues.title,
            newValue: data.title,
          },
        })
      )
    }

    // Log description change
    if (data.description !== undefined && data.description !== oldValues.description) {
      activities.push(
        db.issueActivity.create({
          data: {
            issueId,
            userId,
            userName,
            action: 'updated',
            field: 'description',
            oldValue: oldValues.description || null,
            newValue: data.description || null,
          },
        })
      )
    }

    // Log priority change
    if (data.priority && data.priority !== oldValues.priority) {
      activities.push(
        db.issueActivity.create({
          data: {
            issueId,
            userId,
            userName,
            action: 'updated',
            field: 'priority',
            oldValue: oldValues.priority,
            newValue: data.priority,
          },
        })
      )
    }

    // Log due date change
    if (data.dueDate !== undefined) {
      const newDueDate = data.dueDate ? new Date(data.dueDate).toISOString().slice(0, 10) : null
      if (newDueDate !== oldValues.dueDate) {
        activities.push(
          db.issueActivity.create({
            data: {
              issueId,
              userId,
              userName,
              action: 'updated',
              field: 'dueDate',
              oldValue: oldValues.dueDate || null,
              newValue: newDueDate,
            },
          })
        )
      }
    }

    // Log difficulty change
    if (data.difficulty !== undefined && data.difficulty !== oldValues.difficulty) {
      activities.push(
        db.issueActivity.create({
          data: {
            issueId,
            userId,
            userName,
            action: 'updated',
            field: 'difficulty',
            oldValue: oldValues.difficulty || null,
            newValue: data.difficulty || null,
          },
        })
      )
    }

    // Log assignee change
    if (data.assigneeIds !== undefined) {
      const newAssignees = updatedIssue.assignees?.map((a: any) => a.userName).join(', ') || ''
      if (newAssignees !== oldValues.assignees) {
        const isReassignment = oldValues.assignees && oldValues.assignees.length > 0
        activities.push(
          db.issueActivity.create({
            data: {
              issueId,
              userId,
              userName,
              action: isReassignment ? 'reassigned' : 'assigned',
              field: 'assignees',
              oldValue: oldValues.assignees || null,
              newValue: newAssignees || null,
            },
          })
        )
      }
    }

    // Execute all activity logs in parallel
    if (activities.length > 0) {
      await Promise.all(activities)
    }
  }

  return updatedIssue
}

export async function deleteIssue(teamId: string, issueId: string, userId: string) {
  // Check user's role - only Team Owner or Admin can delete
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
    throw new Error('Unauthorized: Not a team member')
  }

  // Only owner or admin can delete issues
  if (teamMember.role !== 'owner' && teamMember.role !== 'admin') {
    throw new Error('Unauthorized: Only Team Owners and Admins can delete issues')
  }

  return await db.issue.delete({
    where: {
      id: issueId,
      teamId,
    },
  })
}

export async function deleteIssues(teamId: string, issueIds: string[], userId: string) {
  // Check user's role - only Team Owner or Admin can delete
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
    throw new Error('Unauthorized: Not a team member')
  }

  // Only owner or admin can delete issues
  if (teamMember.role !== 'owner' && teamMember.role !== 'admin') {
    throw new Error('Unauthorized: Only Team Owners and Admins can delete issues')
  }

  if (issueIds.length === 0) {
    throw new Error('No issues provided for deletion')
  }

  // Delete all issues in a transaction
  return await db.$transaction(async (tx) => {
    const deletedIssues = await tx.issue.deleteMany({
      where: {
        id: { in: issueIds },
        teamId,
      },
    })

    return deletedIssues
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
