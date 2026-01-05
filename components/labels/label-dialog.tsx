'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

const labelSchema = z.object({
  name: z.string().min(1, 'Label name is required').max(50, 'Label name is too long'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format (use hex like #3b82f6)'),
})

type LabelFormData = z.infer<typeof labelSchema>

interface LabelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { name: string; color: string }) => Promise<void>
  teamId: string
  projectId: string | null | undefined
}

const DEFAULT_COLORS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#64748b', // gray
  '#06b6d4', // cyan
]

export function LabelDialog({
  open,
  onOpenChange,
  onSubmit,
  teamId,
  projectId,
}: LabelDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<LabelFormData>({
    resolver: zodResolver(labelSchema),
    defaultValues: {
      name: '',
      color: DEFAULT_COLORS[0],
    },
  })
  
  // Don't render if no project is selected - check AFTER hooks
  if (!projectId || !open) {
    return null
  }

  const handleSubmit = async (data: LabelFormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      form.reset()
      onOpenChange(false)
    } catch (error) {
      console.error('Error creating label:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Label</DialogTitle>
          <DialogDescription>
            Create a new label for this project. Labels help organize and filter issues.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Bug, Feature, Frontend"
                      {...field}
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          placeholder="#3b82f6"
                          {...field}
                          className="font-mono"
                        />
                        <div
                          className="h-10 w-10 rounded border-2 border-border"
                          style={{ backgroundColor: field.value || DEFAULT_COLORS[0] }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {DEFAULT_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => form.setValue('color', color)}
                            className={cn(
                              "h-8 w-8 rounded border-2 transition-all",
                              field.value === color
                                ? "border-foreground scale-110"
                                : "border-border hover:scale-105"
                            )}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Tag className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Creating...' : 'Create Label'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

