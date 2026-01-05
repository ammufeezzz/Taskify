'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TeamMember {
  userId: string
  userName: string
  role: string
}

interface ReviewerSelectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  excludeUserIds: string[] // Assignee IDs to exclude (can't review their own work)
  onSelect: (reviewerId: string, reviewerName: string) => void
  onCancel?: () => void
}

export function ReviewerSelectModal({
  open,
  onOpenChange,
  teamId,
  excludeUserIds,
  onSelect,
  onCancel,
}: ReviewerSelectModalProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReviewerId, setSelectedReviewerId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch team members when modal opens
  useEffect(() => {
    if (open && teamId) {
      setLoading(true)
      setError(null)
      setSelectedReviewerId(null)
      
      fetch(`/api/teams/${teamId}/members`)
        .then((res) => res.json())
        .then((members) => {
          setTeamMembers(members)
          setLoading(false)
        })
        .catch(() => {
          setError('Failed to load team members')
          setLoading(false)
        })
    }
  }, [open, teamId])

  // Filter out assignees - they can't review their own work
  const eligibleReviewers = teamMembers.filter(
    (member) => !excludeUserIds.includes(member.userId)
  )

  const handleConfirm = () => {
    if (selectedReviewerId) {
      const reviewer = eligibleReviewers.find(m => m.userId === selectedReviewerId)
      if (reviewer) {
        onSelect(reviewer.userId, reviewer.userName)
      }
    }
  }

  const handleCancel = () => {
    setSelectedReviewerId(null)
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleCancel()
      }
    }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Select a Reviewer</DialogTitle>
          <DialogDescription>
            Choose a team member to review this issue before it can be marked as done.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-destructive py-4">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          ) : eligibleReviewers.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No eligible reviewers available.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Assignees cannot review their own work.
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {eligibleReviewers.map((member) => (
                <button
                  key={member.userId}
                  type="button"
                  onClick={() => setSelectedReviewerId(member.userId)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                    selectedReviewerId === member.userId
                      ? "bg-primary/10 border-2 border-primary"
                      : "hover:bg-muted border-2 border-transparent"
                  )}
                >
                  <UserAvatar name={member.userName} className="h-8 w-8" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{member.userName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                  </div>
                  {selectedReviewerId === member.userId && (
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedReviewerId || eligibleReviewers.length === 0}
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

