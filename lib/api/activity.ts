import { db } from '@/lib/db'

// Activity action types
export type ActivityAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'assigned'
  | 'reassigned'
  | 'sent_to_review'
  | 'approved'
  | 'sent_back'
  | 'parent_changed'
  | 'labels_changed'

// Helper to log an activity
export async function logActivity({
  issueId,
  userId,
  userName,
  action,
  field,
  oldValue,
  newValue,
  metadata,
}: {
  issueId: string
  userId: string
  userName: string
  action: ActivityAction
  field?: string
  oldValue?: string | null
  newValue?: string | null
  metadata?: Record<string, any>
}) {
  return await db.issueActivity.create({
    data: {
      issueId,
      userId,
      userName,
      action,
      field,
      oldValue,
      newValue,
      metadata: metadata || undefined,
    },
  })
}

// Log issue creation
export async function logIssueCreated({
  issueId,
  userId,
  userName,
  issueTitle,
}: {
  issueId: string
  userId: string
  userName: string
  issueTitle: string
}) {
  return await logActivity({
    issueId,
    userId,
    userName,
    action: 'created',
    metadata: { title: issueTitle },
  })
}

// Log field update
export async function logFieldUpdate({
  issueId,
  userId,
  userName,
  field,
  oldValue,
  newValue,
}: {
  issueId: string
  userId: string
  userName: string
  field: string
  oldValue: any
  newValue: any
}) {
  // Convert values to strings for storage
  const oldStr = oldValue === null || oldValue === undefined 
    ? null 
    : typeof oldValue === 'object' 
      ? JSON.stringify(oldValue) 
      : String(oldValue)
  
  const newStr = newValue === null || newValue === undefined 
    ? null 
    : typeof newValue === 'object' 
      ? JSON.stringify(newValue) 
      : String(newValue)

  // Don't log if values are the same
  if (oldStr === newStr) return null

  return await logActivity({
    issueId,
    userId,
    userName,
    action: 'updated',
    field,
    oldValue: oldStr,
    newValue: newStr,
  })
}

// Log status change
export async function logStatusChange({
  issueId,
  userId,
  userName,
  oldStatus,
  newStatus,
  oldStatusName,
  newStatusName,
}: {
  issueId: string
  userId: string
  userName: string
  oldStatus: string
  newStatus: string
  oldStatusName?: string
  newStatusName?: string
}) {
  return await logActivity({
    issueId,
    userId,
    userName,
    action: 'status_changed',
    field: 'workflowStateId',
    oldValue: oldStatusName || oldStatus,
    newValue: newStatusName || newStatus,
    metadata: {
      oldStatusId: oldStatus,
      newStatusId: newStatus,
    },
  })
}

// Log assignment
export async function logAssignment({
  issueId,
  userId,
  userName,
  assigneeNames,
  isReassignment = false,
  previousAssignees,
}: {
  issueId: string
  userId: string
  userName: string
  assigneeNames: string[]
  isReassignment?: boolean
  previousAssignees?: string[]
}) {
  return await logActivity({
    issueId,
    userId,
    userName,
    action: isReassignment ? 'reassigned' : 'assigned',
    field: 'assignees',
    oldValue: previousAssignees?.join(', ') || null,
    newValue: assigneeNames.join(', ') || null,
  })
}

// Log sent to review
export async function logSentToReview({
  issueId,
  userId,
  userName,
  reviewerName,
}: {
  issueId: string
  userId: string
  userName: string
  reviewerName?: string
}) {
  return await logActivity({
    issueId,
    userId,
    userName,
    action: 'sent_to_review',
    metadata: { reviewer: reviewerName },
  })
}

// Log approval (moved to Done from Review)
export async function logApproved({
  issueId,
  userId,
  userName,
}: {
  issueId: string
  userId: string
  userName: string
}) {
  return await logActivity({
    issueId,
    userId,
    userName,
    action: 'approved',
  })
}

// Log sent back from review
export async function logSentBack({
  issueId,
  userId,
  userName,
  targetStatus,
  reason,
}: {
  issueId: string
  userId: string
  userName: string
  targetStatus: string
  reason?: string
}) {
  return await logActivity({
    issueId,
    userId,
    userName,
    action: 'sent_back',
    newValue: targetStatus,
    metadata: { reason },
  })
}

// Get activities for an issue (with pagination)
export async function getIssueActivities(
  issueId: string,
  options: {
    limit?: number
    cursor?: string
  } = {}
) {
  const { limit = 50, cursor } = options

  const activities = await db.issueActivity.findMany({
    where: { issueId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // Take one extra to check if there are more
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // Skip the cursor itself
    }),
  })

  const hasMore = activities.length > limit
  const items = hasMore ? activities.slice(0, -1) : activities
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

  return {
    items,
    hasMore,
    nextCursor,
  }
}

// Helper to format activity for display
export function formatActivityMessage(activity: {
  action: string
  field?: string | null
  oldValue?: string | null
  newValue?: string | null
  userName: string
  metadata?: any
}): string {
  const { action, field, oldValue, newValue, userName, metadata } = activity

  switch (action) {
    case 'created':
      return `${userName} created this issue`
    
    case 'updated':
      if (field === 'title') {
        return `${userName} changed title from "${oldValue}" to "${newValue}"`
      }
      if (field === 'description') {
        return `${userName} updated the description`
      }
      if (field === 'priority') {
        return `${userName} changed priority from ${oldValue || 'none'} to ${newValue || 'none'}`
      }
      if (field === 'dueDate') {
        return `${userName} changed due date from ${oldValue || 'none'} to ${newValue || 'none'}`
      }
      if (field === 'difficulty') {
        return `${userName} changed estimated size from ${oldValue || 'none'} to ${newValue || 'none'}`
      }
      return `${userName} updated ${field}`
    
    case 'status_changed':
      return `${userName} changed status from ${oldValue} to ${newValue}`
    
    case 'assigned':
      return `${userName} assigned to ${newValue}`
    
    case 'reassigned':
      return `${userName} reassigned from ${oldValue || 'unassigned'} to ${newValue}`
    
    case 'sent_to_review':
      const reviewerName = metadata?.reviewerName || metadata?.reviewer
      return `${userName} sent for review${reviewerName ? ` to ${reviewerName}` : ''}`
    
    case 'approved':
      return `${userName} approved and closed this issue`
    
    case 'sent_back':
      return `${userName} sent back to ${newValue}`
    
    case 'parent_changed':
      if (!newValue) {
        return `${userName} removed parent issue`
      }
      return `${userName} set parent issue`
    
    case 'labels_changed':
      return `${userName} updated labels`
    
    default:
      return `${userName} performed ${action}`
  }
}


