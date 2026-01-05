'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
// Note: DropdownMenuItem removed - no longer needed for send back
import { Check, ArrowLeft, UserPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { IssueWithRelations } from '@/lib/types'
import { WorkflowState } from '@prisma/client'
import { UserSelector } from '@/components/shared/user-selector'
import { SendBackDialog } from './send-back-dialog'

interface ReviewActionsProps {
  issue: IssueWithRelations
  workflowStates: WorkflowState[]
  teamId: string
  currentUserId: string
  currentUserRole: 'owner' | 'admin' | 'developer'
  onActionComplete?: () => void
}

export function ReviewActions({
  issue,
  workflowStates,
  teamId,
  currentUserId,
  currentUserRole,
  onActionComplete,
}: ReviewActionsProps) {
  const [loading, setLoading] = useState(false)
  const [showReassign, setShowReassign] = useState(false)
  const [showSendBack, setShowSendBack] = useState(false)

  // Only show when issue is in Review
  if (issue.workflowState.type !== 'review') {
    return null
  }

  // Check if current user can perform review actions:
  // - Owner can always review
  // - Admin can always review
  // - The assigned reviewer can review
  const isOwnerOrAdmin = currentUserRole === 'owner' || currentUserRole === 'admin'
  const isAssignedReviewer = currentUserId === issue.reviewerId
  const canReview = isOwnerOrAdmin || isAssignedReviewer

  if (!canReview) {
    return null
  }

  const handleReviewAction = async (action: 'approve' | 'send_back', targetStateId?: string, reason?: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/issues/${issue.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          targetStateId,
          reason,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to perform review action')
      }

      toast.success(
        action === 'approve' 
          ? 'Issue approved and closed' 
          : 'Issue sent back for changes'
      )
      setShowSendBack(false)
      onActionComplete?.()
    } catch (error: any) {
      toast.error(error.message || 'Failed to perform review action')
    } finally {
      setLoading(false)
    }
  }

  const todoState = workflowStates.find(s => s.type === 'unstarted')
  const inProgressState = workflowStates.find(s => s.type === 'started')

  const handleSendBack = (targetState: 'todo' | 'in_progress', reason: string) => {
    const targetStateObj = targetState === 'todo' ? todoState : inProgressState
    if (targetStateObj) {
      handleReviewAction('send_back', targetStateObj.id, reason)
    }
  }

  const handleReassign = async (reviewerId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/issues/${issue.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reassign',
          reviewerId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reassign reviewer')
      }

      toast.success('Reviewer reassigned')
      setShowReassign(false)
      onActionComplete?.()
    } catch (error: any) {
      toast.error(error.message || 'Failed to reassign reviewer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="border-t pt-4 mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Review Actions</p>
            <p className="text-xs text-muted-foreground mt-1">
              {issue.reviewer ? `Reviewer: ${issue.reviewer}` : 'No reviewer assigned'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Approve & Close */}
          <Button
            size="sm"
            onClick={() => handleReviewAction('approve')}
            disabled={loading}
            className="flex-1 sm:flex-initial"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Approve & Close
          </Button>

          {/* Send Back - Opens Dialog */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSendBack(true)}
            disabled={loading}
            className="flex-1 sm:flex-initial"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Send Back
          </Button>

          {/* Reassign Reviewer */}
          <DropdownMenu open={showReassign} onOpenChange={setShowReassign}>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
                className="flex-1 sm:flex-initial"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Reassign
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
              <UserSelector
                value={issue.reviewerId || ''}
                onValueChange={(reviewerId) => {
                  if (reviewerId && reviewerId !== 'unassigned') {
                    handleReassign(reviewerId)
                  } else {
                    setShowReassign(false)
                  }
                }}
                placeholder="Select reviewer"
                teamId={teamId}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Send Back Dialog */}
      <SendBackDialog
        open={showSendBack}
        onOpenChange={setShowSendBack}
        onConfirm={handleSendBack}
        isLoading={loading}
      />
    </>
  )
}

