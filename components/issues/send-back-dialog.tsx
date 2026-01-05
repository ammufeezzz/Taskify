'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SendBackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (targetState: 'todo' | 'in_progress', reason: string) => void
  isLoading?: boolean
}

export function SendBackDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: SendBackDialogProps) {
  const [targetState, setTargetState] = useState<'todo' | 'in_progress'>('in_progress')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = () => {
    // Validate reason is provided
    if (!reason.trim()) {
      setError('Please provide a reason for sending back this issue')
      return
    }
    
    if (reason.trim().length < 10) {
      setError('Please provide a more detailed explanation (at least 10 characters)')
      return
    }

    setError(null)
    onConfirm(targetState, reason.trim())
  }

  const handleClose = () => {
    setReason('')
    setError(null)
    setTargetState('in_progress')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeft className="h-5 w-5" />
            Send Back for Changes
          </DialogTitle>
          <DialogDescription>
            Explain what needs to be fixed or changed. This comment will be visible to the assignee.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Target State Selection */}
          <div className="space-y-2">
            <Label>Send to</Label>
            <RadioGroup
              value={targetState}
              onValueChange={(value) => setTargetState(value as 'todo' | 'in_progress')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="in_progress" id="in_progress" />
                <Label htmlFor="in_progress" className="font-normal cursor-pointer">
                  In Progress
                  <span className="block text-xs text-muted-foreground">Minor fixes needed</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="todo" id="todo" />
                <Label htmlFor="todo" className="font-normal cursor-pointer">
                  Todo
                  <span className="block text-xs text-muted-foreground">Needs re-planning</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Reason Textarea */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Explain what needs to be changed or fixed..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (error) setError(null)
              }}
              className={cn(
                "min-h-[120px] resize-none",
                error && "border-destructive focus-visible:ring-destructive"
              )}
            />
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Be specific about what's wrong and what needs to change.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send Back'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

