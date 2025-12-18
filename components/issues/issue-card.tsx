import { cn } from '@/lib/utils'
import { IssueWithRelations, PriorityLevel } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { PriorityIcon } from '@/components/shared/priority-icon'
import { Loader2 } from 'lucide-react'

interface IssueCardProps {
  issue: IssueWithRelations
  onClick?: () => void
  className?: string
  isDragging?: boolean
}

export function IssueCard({ 
  issue, 
  onClick,
  className, 
  isDragging 
}: IssueCardProps) {
  const issueId = `${issue.project?.key || issue.team.key}-${issue.number}`
  const isOptimistic = (issue as any).isOptimistic || issue.id.startsWith('temp-')
  
  // Get assignee initials for the custom gradient circle
  const getAssigneeInitials = (name?: string | null) => {
    if (name) {
      return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return '??'
  }

  // Get assignees (prefer new assignees relation, fallback to legacy single assignee)
  const assignees = issue.assignees?.length > 0 
    ? issue.assignees 
    : issue.assigneeId 
      ? [{ userId: issue.assigneeId, userName: issue.assignee || 'Unknown' }] 
      : []

  return (
    <Card
      className={cn(
        'p-2.5 sm:p-3 cursor-pointer transition-all hover:shadow-sm border-border/40 bg-card/80 backdrop-blur-sm',
        'touch-manipulation active:scale-[0.98]',
        isDragging && 'opacity-50',
        isOptimistic && 'opacity-75 animate-pulse border-primary/30',
        className
      )}
      onClick={onClick}
    >
      <div className="space-y-2.5">
        {/* Issue ID */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOptimistic && (
              <Loader2 className="h-3 w-3 text-primary animate-spin" />
            )}
            <span className="font-mono text-xs font-medium text-muted-foreground">
              {issueId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Priority */}
            <PriorityIcon 
              priority={(issue.priority || 'none') as PriorityLevel} 
              className="opacity-70"
            />
            {/* Assignees (stacked avatars) */}
            {assignees.length > 0 && (
              <div className="flex -space-x-1.5">
                {assignees.slice(0, 3).map((assignee, idx) => {
                  const initials = getAssigneeInitials(assignee.userName)
                  return (
                    <div 
                      key={assignee.userId || idx}
                      className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-medium flex-shrink-0 ring-1 ring-background"
                      title={assignee.userName}
                    >
                      {initials}
                    </div>
                  )
                })}
                {assignees.length > 3 && (
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-medium flex-shrink-0 ring-1 ring-background">
                    +{assignees.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-normal text-sm text-foreground leading-snug line-clamp-2">
          {issue.title}
        </h3>
        {/* Meta: difficulty + due date */}
        <div className="flex items-center gap-2">
          {issue.difficulty && (
            <span
              className={cn(
                'text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center justify-center',
                issue.difficulty === 'S' ? 'bg-green-100 text-green-800' :
                issue.difficulty === 'M' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              )}
            >
              {issue.difficulty}
            </span>
          )}

          {issue.dueDate && (
            <span className="text-xs text-muted-foreground">
              {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(issue.dueDate))}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}
