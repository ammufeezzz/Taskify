'use client'

import { formatDistanceToNow } from 'date-fns'
import { 
  Activity, 
  Plus, 
  Edit, 
  ArrowRight, 
  UserPlus, 
  UserCheck,
  CheckCircle,
  RotateCcw,
  Send
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { IssueActivity } from '@/lib/hooks/use-team-data'
import { formatActivityMessage } from '@/lib/api/activity'

interface ActivityLogProps {
  activities: IssueActivity[]
  isLoading?: boolean
}

function getActivityIcon(action: string) {
  switch (action) {
    case 'created':
      return <Plus className="h-3.5 w-3.5" />
    case 'updated':
      return <Edit className="h-3.5 w-3.5" />
    case 'status_changed':
      return <ArrowRight className="h-3.5 w-3.5" />
    case 'assigned':
      return <UserPlus className="h-3.5 w-3.5" />
    case 'reassigned':
      return <UserCheck className="h-3.5 w-3.5" />
    case 'sent_to_review':
      return <Send className="h-3.5 w-3.5" />
    case 'approved':
      return <CheckCircle className="h-3.5 w-3.5" />
    case 'sent_back':
      return <RotateCcw className="h-3.5 w-3.5" />
    default:
      return <Activity className="h-3.5 w-3.5" />
  }
}

function getActivityColor(action: string) {
  switch (action) {
    case 'created':
      return 'bg-emerald-500/20 text-emerald-400'
    case 'approved':
      return 'bg-green-500/20 text-green-400'
    case 'sent_to_review':
      return 'bg-violet-500/20 text-violet-400'
    case 'sent_back':
      return 'bg-amber-500/20 text-amber-400'
    case 'assigned':
    case 'reassigned':
      return 'bg-blue-500/20 text-blue-400'
    case 'status_changed':
      return 'bg-cyan-500/20 text-cyan-400'
    default:
      return 'bg-zinc-500/20 text-zinc-400'
  }
}

export function ActivityLog({ activities, isLoading }: ActivityLogProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-5 w-5 border-2 border-zinc-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
        <Activity className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No activity yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {activities.map((activity, index) => (
        <div 
          key={activity.id} 
          className={cn(
            "flex items-start gap-3 py-2.5 px-2 rounded-md",
            "hover:bg-zinc-800/30 transition-colors"
          )}
        >
          {/* Icon */}
          <div className={cn(
            "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5",
            getActivityColor(activity.action)
          )}>
            {getActivityIcon(activity.action)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-300">
              {formatActivityMessage(activity)}
            </p>
            {/* Display reason as a quote block for sent_back actions */}
            {activity.action === 'sent_back' && activity.metadata?.reason && (
              <div className="mt-1.5 pl-3 border-l-2 border-amber-500/50">
                <p className="text-xs text-zinc-400 italic">
                  "{activity.metadata.reason}"
                </p>
              </div>
            )}
            <p className="text-xs text-zinc-500 mt-0.5">
              {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}


