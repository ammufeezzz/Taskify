import { Issue, Project, WorkflowState, Label, Comment, Team, IssueLabel, ProjectMember, IssueAssignee } from '@prisma/client'

// Assignee type for multiple assignees
export interface IssueAssigneeInfo {
  userId: string
  userName: string
}

// Minimal issue info for parent/children references (avoid circular types)
export interface IssueBasicInfo {
  id: string
  title: string
  number: number
  workflowStateId: string
  workflowState: WorkflowState
  assignee?: string | null
  assignees?: IssueAssignee[]
  dueDate?: Date | null
  priority?: string
}

// Extended types with relations
export type IssueWithRelations = Issue & {
  project?: Project | null
  workflowState: WorkflowState
  team: Team
  assignee?: string | null // Legacy single assignee (deprecated)
  assignees: IssueAssignee[] // Multiple assignees
  creator: string
  reviewedAt?: Date | null // Timestamp when issue entered Review stage
  reviewerId?: string | null // User ID of the reviewer
  reviewer?: string | null // Reviewer display name
  labels: (IssueLabel & { label: Label })[]
  comments: Comment[]
  parentId?: string | null // Parent issue ID for sub-issues
  parent?: IssueBasicInfo | null // Parent issue reference
  children?: IssueBasicInfo[] // Sub-issues
}

export type ProjectWithRelations = Project & {
  team: Team
  lead?: string | null
  issues: Issue[]
  members: ProjectMember[]
  _count: {
    issues: number
  }
}

export type WorkflowStateWithCount = WorkflowState & {
  _count: {
    issues: number
  }
}

export type LabelWithCount = Label & {
  _count: {
    issues: number
  }
}

// API Response types
export interface CreateIssueData {
  title: string
  description?: string
  projectId?: string
  workflowStateId: string
  assigneeIds?: string[] // Multiple assignees
  assigneeId?: string // Legacy single assignee (deprecated)
  assignee?: string // Legacy single assignee name (deprecated)
  priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent'
  estimate?: number
  labelIds?: string[]
  dueDate?: string
  difficulty?: 'S' | 'M' | 'L'
  parentId?: string // Parent issue ID for creating sub-issues
}

export interface UpdateIssueData {
  title?: string
  description?: string | null
  projectId?: string | null
  workflowStateId?: string
  assigneeIds?: string[] // Multiple assignees
  assigneeId?: string | null // Legacy single assignee (deprecated)
  assignee?: string | null // Legacy single assignee name (deprecated)
  priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent'
  estimate?: number | null
  labelIds?: string[]
  number?: number
  dueDate?: string | null
  difficulty?: 'S' | 'M' | 'L' | null
  parentId?: string | null // Parent issue ID for sub-issues
  reviewerId?: string | null // Reviewer user ID (required when moving to Review)
  reviewer?: string | null // Reviewer display name
}

export interface CreateProjectData {
  name: string
  description?: string
  key: string
  color?: string
  icon?: string
  leadId?: string
  lead?: string
  status?: 'active' | 'completed' | 'canceled'
}

export interface UpdateProjectData {
  name?: string
  description?: string
  key?: string
  color?: string
  icon?: string
  leadId?: string | null
  lead?: string | null
  status?: 'active' | 'completed' | 'canceled'
}

export interface CreateWorkflowStateData {
  name: string
  type: 'backlog' | 'unstarted' | 'started' | 'review' | 'completed' | 'canceled'
  color?: string
  position?: number
}

export interface CreateLabelData {
  name: string
  color?: string
}

// Filter types
export interface IssueFilters {
  status?: string[]
  assignee?: string[]
  project?: string[]
  label?: string[]
  priority?: string[]
  search?: string
}

export interface IssueSort {
  field: 'title' | 'createdAt' | 'updatedAt' | 'priority' | 'number'
  direction: 'asc' | 'desc'
}

// View types
export type ViewType = 'board' | 'table'

// Priority levels
export const PRIORITY_LEVELS = {
  none: { label: 'None', value: 0, color: '#64748b' },
  low: { label: 'Low', value: 1, color: '#10b981' },
  medium: { label: 'Medium', value: 2, color: '#f59e0b' },
  high: { label: 'High', value: 3, color: '#ef4444' },
  urgent: { label: 'Urgent', value: 4, color: '#dc2626' },
} as const

export type PriorityLevel = keyof typeof PRIORITY_LEVELS

// Workflow state types
export const WORKFLOW_STATE_TYPES = {
  backlog: { label: 'Backlog', color: '#64748b' },
  unstarted: { label: 'Todo', color: '#8b5cf6' },
  started: { label: 'In Progress', color: '#3b82f6' },
  completed: { label: 'Done', color: '#10b981' },
  canceled: { label: 'Canceled', color: '#ef4444' },
} as const

export type WorkflowStateType = keyof typeof WORKFLOW_STATE_TYPES
