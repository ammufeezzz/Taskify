"use client";

import { IssueWithRelations } from "@/lib/types";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface SubIssueTreeProps {
  parentId: string;
  allIssues: IssueWithRelations[];
  onIssueClick: (issue: IssueWithRelations) => void;
  level?: number;
}

// Recursive component to render the issue tree
export function SubIssueTree({
  parentId,
  allIssues,
  onIssueClick,
  level = 0,
}: SubIssueTreeProps) {
  // Find direct children of this parent
  const children = allIssues.filter((issue) => issue.parentId === parentId);

  if (children.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      {children.map((child) => (
        <SubIssueItem
          key={child.id}
          issue={child}
          allIssues={allIssues}
          onIssueClick={onIssueClick}
          level={level}
        />
      ))}
    </div>
  );
}

interface SubIssueItemProps {
  issue: IssueWithRelations;
  allIssues: IssueWithRelations[];
  onIssueClick: (issue: IssueWithRelations) => void;
  level: number;
}

function SubIssueItem({
  issue,
  allIssues,
  onIssueClick,
  level,
}: SubIssueItemProps) {
  const [expanded, setExpanded] = useState(true);
  
  // Find direct children of this issue
  const directChildren = allIssues.filter((i) => i.parentId === issue.id);
  const hasChildren = directChildren.length > 0;
  
  // Count completed direct children only (not grandchildren)
  const completedChildren = directChildren.filter(
    (c) => c.workflowState?.type === "completed"
  ).length;

  return (
    <div>
      {/* Issue row */}
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer group",
          level > 0 && "ml-4"
        )}
        style={{ marginLeft: level > 0 ? `${level * 16}px` : undefined }}
      >
        {/* Expand/collapse button for items with children */}
        <div className="w-4 h-4 flex-shrink-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}
        </div>

        {/* Status indicator */}
        <div
          className="h-2 w-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: issue.workflowState?.color || "#64748b" }}
        />

        {/* Issue number */}
        <span className="font-mono text-xs text-muted-foreground flex-shrink-0">
          #{issue.number}
        </span>

        {/* Issue title - clickable */}
        <span
          className="text-sm truncate flex-1 hover:text-primary hover:underline"
          onClick={() => onIssueClick(issue)}
        >
          {issue.title}
        </span>

        {/* Assignee */}
        {issue.assignee && (
          <span className="text-xs text-muted-foreground hidden group-hover:block">
            {issue.assignee}
          </span>
        )}

        {/* Children count if has children */}
        {hasChildren && (
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
            {completedChildren}/{directChildren.length}
          </span>
        )}

        {/* Arrow to indicate clickable */}
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Recursive children */}
      {hasChildren && expanded && (
        <SubIssueTree
          parentId={issue.id}
          allIssues={allIssues}
          onIssueClick={onIssueClick}
          level={level + 1}
        />
      )}
    </div>
  );
}

// Helper function to count all descendants (for progress calculation)
export function countDescendants(
  parentId: string,
  allIssues: IssueWithRelations[]
): { total: number; completed: number } {
  const children = allIssues.filter((issue) => issue.parentId === parentId);
  
  let total = children.length;
  let completed = children.filter(
    (c) => c.workflowState?.type === "completed"
  ).length;

  // Recursively count grandchildren
  for (const child of children) {
    const grandchildCounts = countDescendants(child.id, allIssues);
    total += grandchildCounts.total;
    completed += grandchildCounts.completed;
  }

  return { total, completed };
}

