'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Columns, Table } from 'lucide-react'
import { ViewType } from '@/lib/types'

interface ViewSwitcherProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
  views?: ViewType[]
  className?: string
}

const viewConfig = {
  board: {
    label: 'Board',
    icon: Columns,
    description: 'Kanban board'
  },
  table: {
    label: 'Table',
    icon: Table,
    description: 'Table view'
  }
}

export function ViewSwitcher({ currentView, onViewChange, views, className }: ViewSwitcherProps) {
  const availableViews = views || Object.keys(viewConfig) as ViewType[]
  
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {availableViews.map((view) => {
        const config = viewConfig[view]
        if (!config) return null // Skip if view config doesn't exist
        const Icon = config.icon
        const isActive = currentView === view
        
        return (
          <Button
            key={view}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange(view)}
            className={cn(
              'flex items-center gap-2',
              isActive && 'bg-primary text-primary-foreground'
            )}
            title={config.description}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{config.label}</span>
          </Button>
        )
      })}
    </div>
  )
}
