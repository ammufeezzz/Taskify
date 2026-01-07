'use client'

import { Button } from '@/components/ui/button'
import { Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BulkActionsBarProps {
  selectedCount: number
  onBulkDelete: () => void
  onClearSelection: () => void
  currentUserRole?: 'owner' | 'admin' | 'developer'
  className?: string
}

export function BulkActionsBar({
  selectedCount,
  onBulkDelete,
  onClearSelection,
  currentUserRole,
  className
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null

  const canDelete = currentUserRole === 'owner' || currentUserRole === 'admin'

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
        "bg-background border border-border rounded-lg shadow-lg",
        "px-4 py-3 flex items-center gap-4",
        className
      )}
    >
      <div className="text-sm font-medium">
        {selectedCount} issue{selectedCount !== 1 ? 's' : ''} selected
      </div>
      
      <div className="flex items-center gap-2">
        {canDelete && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onBulkDelete}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  )
}

