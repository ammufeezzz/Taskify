"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateIssueData, UpdateIssueData, PriorityLevel } from "@/lib/types";
import { Project, WorkflowState, Label as LabelType } from "@prisma/client";
import { UserSelector } from "@/components/shared/user-selector";
import { UserAvatar } from "@/components/shared/user-avatar";
import { PriorityIcon } from "@/components/shared/priority-icon";
import { useLabels, useIssueActivities } from "@/lib/hooks/use-team-data";
import {
  Circle,
  MoreHorizontal,
  User,
  Settings,
  Tag,
  MoreVertical,
  X,
  Check,
  Eye,
  GitBranch,
  Plus,
  ChevronRight,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ISSUE_ACTION } from "@/app/dashboard/[teamId]/issues/page";
import { toast } from "sonner";
import { ReviewActions } from "./review-actions";
import { IssueWithRelations } from "@/lib/types";
import { LabelDialog } from "@/components/labels/label-dialog";
import { SubIssueTree } from "./sub-issue-tree";
import { ActivityLog } from "./activity-log";
import { ReviewerSelectModal } from "./reviewer-select-modal";

// Schema for creating issues - mandatory fields enforced
const createIssueSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title is too long"),
  description: z.string().optional(),
  projectId: z.string().optional(),
  workflowStateId: z.string().min(1, "Stage is required"),
  assigneeIds: z.array(z.string()).min(1, "At least one assignee is required"),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
  estimate: z.number().min(0).optional(),
  labelIds: z.array(z.string()).min(1, "At least one tag is required"),
  endDate: z.string().min(1, "Due date is required"),
  difficulty: z.enum(["S", "M", "L"], { message: "Estimated size is required" }),
  parentId: z.string().optional(),
});

// Schema for editing issues - more lenient
const editIssueSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title is too long"),
  description: z.string().optional(),
  projectId: z.string().optional(),
  workflowStateId: z.string().min(1, "Status is required"),
  assigneeIds: z.array(z.string()).optional(),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
  estimate: z.number().min(0).optional(),
  labelIds: z.array(z.string()).optional(),
  endDate: z.string().optional(),
  difficulty: z.enum(["S", "M", "L"]).optional(),
  parentId: z.string().optional().nullable(),
});

// Combined schema type for form
const issueSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title is too long"),
  description: z.string().optional(),
  projectId: z.string().optional(),
  workflowStateId: z.string().min(1, "Status is required"),
  assigneeIds: z.array(z.string()).optional(),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
  estimate: z.number().min(0).optional(),
  labelIds: z.array(z.string()).optional(),
  endDate: z.string().optional(),
  difficulty: z.enum(["S", "M", "L"]).optional(),
  parentId: z.string().optional().nullable(),
});

type IssueFormData = z.infer<typeof issueSchema>;

interface IssueDialogProps {
  action: ISSUE_ACTION;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateIssueData | UpdateIssueData) => Promise<void>;
  projects: Project[];
  workflowStates: WorkflowState[];
  labels: LabelType[];
  initialData?: Partial<IssueFormData>;
  title?: string;
  description?: string;
  teamId?: string;
  teamName?: string;
  currentUserId?: string; // Current user ID for default assignee
  currentUserRole?: 'owner' | 'admin' | 'developer'; // Current user role for review actions
  issue?: IssueWithRelations; // Full issue data for review actions
  onIssueUpdate?: () => void; // Callback when issue is updated via review actions
  defaultParentId?: string; // Pre-selected parent ID when creating sub-issue
  allIssues?: IssueWithRelations[]; // All issues for parent selector
  onCreateSubIssue?: (parentId: string) => void; // Callback to create sub-issue
  onSubIssueClick?: (issue: IssueWithRelations) => void; // Callback when clicking a sub-issue
}

export function IssueDialog({
  open,
  onOpenChange,
  onSubmit,
  projects,
  workflowStates,
  labels: labelsProp,
  initialData,
  description = "Create a new issue for your team.",
  teamId,
  teamName,
  action,
  currentUserId,
  currentUserRole,
  issue,
  onIssueUpdate,
  defaultParentId,
  allIssues = [],
  onCreateSubIssue,
  onSubIssueClick,
}: IssueDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<string[]>(
    initialData?.labelIds || [],
  );
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    initialData?.assigneeIds || (action === ISSUE_ACTION.CREATE && currentUserId ? [currentUserId] : []),
  );
  const [createMore, setCreateMore] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [createLabelDialogOpen, setCreateLabelDialogOpen] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(
    defaultParentId || initialData?.parentId || null
  );
  const [showActivity, setShowActivity] = useState(false);
  const [showSubIssues, setShowSubIssues] = useState(true);
  const [showReviewerModal, setShowReviewerModal] = useState(false);
  const [pendingReviewStateId, setPendingReviewStateId] = useState<string | null>(null);
  const [selectedReviewer, setSelectedReviewer] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  // Fetch activities for the issue (only in edit mode)
  const { data: activitiesData, isLoading: activitiesLoading } = useIssueActivities(
    teamId || '',
    action === ISSUE_ACTION.EDIT ? issue?.id : undefined
  );

  // Use appropriate schema based on action
  const validationSchema = action === ISSUE_ACTION.CREATE ? createIssueSchema : editIssueSchema;

  const form = useForm<IssueFormData>({
    resolver: zodResolver(validationSchema),
    mode: "onChange",
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      projectId: initialData?.projectId || "",
      workflowStateId:
        initialData?.workflowStateId ||
        (workflowStates.length > 0 ? workflowStates[0].id : ""),
      // Default assignees to current user for new issues
      assigneeIds: initialData?.assigneeIds || (action === ISSUE_ACTION.CREATE && currentUserId ? [currentUserId] : []),
      priority: initialData?.priority || "none",
      estimate: initialData?.estimate,
      labelIds: initialData?.labelIds || [],
      endDate: initialData?.endDate || "",
      difficulty: initialData?.difficulty || undefined,
      parentId: defaultParentId || initialData?.parentId || undefined,
    },
  });

  // Get current project ID from form or issue
  const currentProjectId = form.watch("projectId") || issue?.projectId || null;
  
  // Fetch project-specific labels
  const { data: fetchedLabels = [] } = useLabels(teamId || "", currentProjectId);
  
  // Use fetched labels if available, otherwise fall back to prop (for backward compatibility)
  const labels: LabelType[] = fetchedLabels.length > 0 ? fetchedLabels : (labelsProp || []);

  // Form reset values - default assignee to current user for new issues
  const formReset: IssueFormData = {
    title: "",
    description: "",
    projectId: "",
    workflowStateId: workflowStates.length > 0 ? workflowStates[0].id : "",
    assigneeIds: action === ISSUE_ACTION.CREATE && currentUserId ? [currentUserId] : [],
    priority: "none",
    estimate: undefined,
    labelIds: [],
    endDate: "",
    difficulty: undefined,
    parentId: undefined,
  };

  useEffect(() => {
    if (open && initialData && !isSubmitting && !createMore) {
      const resetData = {
        ...initialData,
        title: initialData.title || "",
        projectId: initialData.projectId || "",
        workflowStateId:
          initialData.workflowStateId ||
          (workflowStates.length > 0 ? workflowStates[0].id : ""),
        assigneeIds: initialData.assigneeIds || [],
        priority: initialData.priority || "none",
        labelIds: initialData.labelIds || [],
      };
      form.reset(resetData);
      setSelectedLabels(initialData.labelIds || []);
      setSelectedAssignees(initialData.assigneeIds || []);
      setSelectedParentId(initialData.parentId || null);
      // Trigger validation to ensure form is valid
      setTimeout(() => {
        form.trigger();
      }, 0);
    } else if (open && !isSubmitting) {
      // To prevent On update re render
      // Check if we're creating from a board column
      const storedWorkflowStateId =
        typeof window !== "undefined"
          ? sessionStorage.getItem("createIssueWorkflowStateId")
          : null;

      const defaultWorkflowStateId =
        storedWorkflowStateId ||
        (workflowStates.length > 0 ? workflowStates[0].id : "");

      if (storedWorkflowStateId && typeof window !== "undefined") {
        sessionStorage.removeItem("createIssueWorkflowStateId");
      }

      // Reset form with default values, including current user as assignee for new issues
      const defaultAssignees = action === ISSUE_ACTION.CREATE && currentUserId ? [currentUserId] : [];
      
      // Set parent ID from prop (when creating sub-issue)
      setSelectedParentId(defaultParentId || null);
      
      const resetValues: IssueFormData = {
        title: "",
        description: "",
        projectId: "",
        workflowStateId: defaultWorkflowStateId,
        assigneeIds: defaultAssignees,
        priority: "none",
        estimate: undefined,
        labelIds: [],
        endDate: "",
        difficulty: undefined,
      };
      form.reset(resetValues);
      setSelectedLabels([]);
      setSelectedAssignees(defaultAssignees);
    }
  }, [isSubmitting, open, initialData, form, workflowStates, action, currentUserId, createMore, defaultParentId]);

  useEffect(() => {
    if (workflowStates.length > 0) {
      const currentWorkflowStateId = form.getValues("workflowStateId");
      // If no workflow state is set, or if the current one is invalid, set default
      if (
        !currentWorkflowStateId ||
        !workflowStates.find((s) => s.id === currentWorkflowStateId)
      ) {
        form.setValue("workflowStateId", workflowStates[0].id);
      }
    }
  }, [workflowStates, form]);

  const handleSubmit = async (data: IssueFormData) => {
    setIsSubmitting(true);
    try {
      // Prepare the submission data
      // For updates, send all fields (even if empty) so the backend can properly normalize them
      // For creates, mandatory fields are enforced
      const isUpdate = !!initialData;

      if (action === ISSUE_ACTION.CREATE) {
        // Use createIssueSchema for validation with selectedLabels and selectedAssignees
        const dataToValidate = {
          ...data,
          labelIds: selectedLabels,
          assigneeIds: selectedAssignees,
        };
        const result = createIssueSchema.safeParse(dataToValidate);

        if (!result.success) {
          const firstError = result.error.issues[0];
          toast.error(firstError.message || "Validation failed");
          // Focus on the appropriate field based on the error
          const fieldName = firstError.path[0] as keyof IssueFormData;
          if (fieldName === "title" || fieldName === "description") {
            form.setFocus(fieldName);
          }
          setIsSubmitting(false);
          return;
        }
        const submitData: CreateIssueData = {
          title: data.title,
          description: data.description || undefined,
          workflowStateId: data.workflowStateId,
          projectId:
            data.projectId && data.projectId.trim() !== ""
              ? data.projectId
              : undefined,
          assigneeIds: selectedAssignees, // Multiple assignees
          priority: data.priority || "none",
          estimate: data.estimate,
          labelIds: selectedLabels,
          dueDate: data.endDate,
          difficulty: data.difficulty,
          parentId: selectedParentId || undefined,
        };
        await onSubmit(submitData);
      } else if (isUpdate) {
        // Make improments for Assign and Move
        const isTrue = data.title.trim() === "";

        if (isTrue) {
          toast.error("Titla is Required");
          form.setFocus("title");
          return;
        }

        const submitData: UpdateIssueData = {
          title: data.title,
          description:
            data.description === "" ? null : data.description || undefined,
          workflowStateId: data.workflowStateId,
          projectId:
            data.projectId && data.projectId.trim() !== ""
              ? data.projectId
              : null,
          assigneeIds: selectedAssignees, // Multiple assignees
          priority: data.priority || "none",
          estimate: data.estimate,
          labelIds: selectedLabels,
          dueDate: data.endDate === "" ? null : data.endDate || undefined,
          difficulty: data.difficulty || undefined,
          // Preserve parent-child relationship on update
          parentId: selectedParentId || null,
          // Include reviewer info when moving to Review state
          ...(selectedReviewer && {
            reviewerId: selectedReviewer.id,
            reviewer: selectedReviewer.name,
          }),
        };
        await onSubmit(submitData);
      }

      form.reset(formReset);
      setSelectedLabels([]);
      setSelectedAssignees(action === ISSUE_ACTION.CREATE && currentUserId ? [currentUserId] : []);
      setSelectedParentId(null);
      setSelectedReviewer(null);
      if (createMore && action === ISSUE_ACTION.CREATE) {
        form.setFocus("title");
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error submitting issue:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId],
    );
  };

  const currentStatus = workflowStates.find(
    (s) => s.id === form.watch("workflowStateId"),
  );
  const currentPriority = form.watch("priority") as PriorityLevel;
  const currentProject = projects.find((p) => p.id === currentProjectId);
  const selectedLabelsData: LabelType[] = labels.filter((l) =>
    selectedLabels.includes(l.id),
  );

  // Check if issue is locked (in Review state)
  const isInReview = issue?.workflowState?.type === 'review';
  const isCurrentUserReviewer = currentUserId === issue?.reviewerId;
  const isLocked = isInReview && action === ISSUE_ACTION.EDIT;
  
  // Check if current user is an assignee (not the reviewer)
  const isCurrentUserAssignee = currentUserId && (
    selectedAssignees.includes(currentUserId) ||
    issue?.assignees?.some(a => a.userId === currentUserId) ||
    issue?.assigneeId === currentUserId
  );
  const isAssigneeNotReviewer = isCurrentUserAssignee && !isCurrentUserReviewer;

  // Get assignee names from team members
  const [teamMembers, setTeamMembers] = useState<{ userId: string; userName: string }[]>([]);

  useEffect(() => {
    if (teamId) {
      fetch(`/api/teams/${teamId}/members`)
        .then((res) => res.json())
        .then((members) => {
          setTeamMembers(members.map((m: any) => ({ userId: m.userId, userName: m.userName })));
        })
        .catch(() => setTeamMembers([]));
    }
  }, [teamId]);

  // Get selected assignee names
  const selectedAssigneeNames = selectedAssignees
    .map(id => teamMembers.find(m => m.userId === id)?.userName)
    .filter(Boolean);

  // Toggle assignee selection
  const toggleAssignee = (userId: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const getStatusIcon = (stateType: string) => {
    switch (stateType) {
      case "backlog":
        return <MoreHorizontal className="h-4 w-4" />;
      case "unstarted":
        return (
          <Circle
            className="h-4 w-4"
            style={{ fill: "none", strokeWidth: 2 }}
          />
        );
      case "started":
        return (
          <Circle
            className="h-4 w-4"
            style={{ fill: "none", strokeWidth: 2 }}
          />
        );
      case "review":
        return <Eye className="h-4 w-4" />;
      case "completed":
        return (
          <div className="h-4 w-4 rounded-full border-2 flex items-center justify-center">
            <Check className="h-2.5 w-2.5" />
          </div>
        );
      default:
        return (
          <Circle
            className="h-4 w-4"
            style={{ fill: "none", strokeWidth: 2 }}
          />
        );
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[700px] max-h-[85vh] p-0 gap-0 [&>button]:hidden flex flex-col overflow-hidden"
        onEscapeKeyDown={() => {
          form.reset(formReset);
        }}
        onInteractOutside={(e) => {
          // Don't reset if another dialog is open (LabelDialog or ReviewerSelectModal)
          if (createLabelDialogOpen || showReviewerModal) {
            e.preventDefault()
            return
          }
          form.reset(formReset);
        }}
      >
        {/* Custom Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {action === ISSUE_ACTION.EDIT ? "Edit issue" : "New issue"}
            </span>

            {/* Action Icons */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => {
                  onOpenChange(false);
                  form.reset(formReset);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Lock Banner - Show when issue is in Review */}
        {isLocked && (
          <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20">
              <Lock className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-500">Locked for Review</p>
              <p className="text-xs text-amber-500/70">
                {issue?.reviewer 
                  ? `This issue is being reviewed by ${issue.reviewer}. Only the reviewer can make changes.`
                  : 'This issue is in review and cannot be edited.'}
              </p>
            </div>
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Title Input */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder={action === ISSUE_ACTION.CREATE ? "Issue title *" : "Issue title"}
                        className={cn(
                          "text-lg font-medium border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto py-2",
                          isLocked && "opacity-60 cursor-not-allowed"
                        )}
                        disabled={isLocked}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description Input */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Add description... (optional)"
                        className={cn(
                          "border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none min-h-[100px] text-muted-foreground",
                          isLocked && "opacity-60 cursor-not-allowed"
                        )}
                        disabled={isLocked}
                        {...field}
                        onKeyDown={async (e) => {
                          if (isLocked) return;
                          if (e.key == "Enter" && (e.ctrlKey || e.metaKey)) {
                            const data = form.getValues();
                            await handleSubmit(data);
                          }
                          if (e.key == "Escape") {
                            // Prevent the data to be store .... or even give an alert as per design pattern
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Due Date & Estimated Size */}
              <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4", isLocked && "opacity-60")}>
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex flex-col gap-1.5">
                        {action === ISSUE_ACTION.CREATE && (
                          <label className="text-sm text-muted-foreground">Due Date <span className="text-destructive">*</span></label>
                        )}
                        <FormControl>
                          <Input
                            type="date"
                            placeholder="Due date"
                            className="border border-border/70"
                            disabled={isLocked}
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="difficulty"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex flex-col gap-1.5">
                        {action === ISSUE_ACTION.CREATE && (
                          <label className="text-sm text-muted-foreground">Estimated Size <span className="text-destructive">*</span></label>
                        )}
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isLocked}
                        >
                          <FormControl>
                            <SelectTrigger className="border border-border/70">
                              <SelectValue placeholder="Size (S / M / L)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="S">Small (S)</SelectItem>
                            <SelectItem value="M">Medium (M)</SelectItem>
                            <SelectItem value="L">Large (L)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Property Buttons Row */}
              <div className={cn("flex items-center gap-2 flex-wrap", isLocked && "opacity-60 pointer-events-none")}>
                {/* Project Button */}
                <DropdownMenu open={!isLocked && projectOpen} onOpenChange={setProjectOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLocked}
                      className={cn(
                        "h-8 px-3 font-mono text-sm border rounded-md transition-colors",
                        currentProject
                          ? "bg-background border-border hover:bg-muted"
                          : "bg-muted/50 border-border/50 hover:bg-muted",
                      )}
                    >
                      {currentProject ? (
                        <span className="text-foreground font-medium">
                          {currentProject.key}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          No project
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64">
                    <DropdownMenuItem
                      onClick={() => {
                        form.setValue("projectId", "");
                        setProjectOpen(false);
                      }}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-muted-foreground">No project</span>
                      {!currentProjectId && (
                        <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </DropdownMenuItem>
                    {projects.map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        onClick={() => {
                          form.setValue("projectId", project.id);
                          setProjectOpen(false);
                        }}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="font-mono text-sm flex-shrink-0">
                            {project.key}
                          </span>
                          <span className="text-sm text-muted-foreground truncate">
                            {project.name}
                          </span>
                        </div>
                        {currentProjectId === project.id && (
                          <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Parent Issue Button */}
                {allIssues.length > 0 && (
                  <DropdownMenu open={parentOpen} onOpenChange={setParentOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          "h-8 px-3 gap-2",
                          selectedParentId && "bg-primary/10 border-primary/20"
                        )}
                      >
                        <GitBranch className="h-4 w-4" />
                        <span>
                          {selectedParentId
                            ? `Parent: ${allIssues.find(i => i.id === selectedParentId)?.title?.slice(0, 20)}${(allIssues.find(i => i.id === selectedParentId)?.title?.length || 0) > 20 ? '...' : ''}`
                            : "Parent Issue"}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-80 max-h-64 overflow-y-auto">
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedParentId(null);
                          setParentOpen(false);
                        }}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-muted-foreground">No parent (top-level issue)</span>
                        {!selectedParentId && (
                          <Check className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                      </DropdownMenuItem>
                      {allIssues
                        .filter(i => i.id !== issue?.id) // Don't show current issue as potential parent
                        .map((parentIssue) => (
                          <DropdownMenuItem
                            key={parentIssue.id}
                            onClick={() => {
                              setSelectedParentId(parentIssue.id);
                              // Auto-inherit project from parent if not set
                              if (!form.getValues("projectId") && parentIssue.projectId) {
                                form.setValue("projectId", parentIssue.projectId);
                              }
                              setParentOpen(false);
                            }}
                            className={cn(
                              "flex items-center gap-2 cursor-pointer",
                              selectedParentId === parentIssue.id && "bg-primary/10 border-l-2 border-l-primary"
                            )}
                          >
                            <div className="flex flex-col flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">
                                  #{parentIssue.number}
                                </span>
                                <span className="truncate text-sm">{parentIssue.title}</span>
                              </div>
                              {parentIssue.project && (
                                <span className="text-xs text-muted-foreground">
                                  {parentIssue.project.key}
                                </span>
                              )}
                            </div>
                            {selectedParentId === parentIssue.id && (
                              <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            )}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Status/Stage Button */}
                <DropdownMenu open={statusOpen} onOpenChange={setStatusOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2"
                    >
                      {currentStatus && getStatusIcon(currentStatus.type)}
                      <span>
                        {currentStatus?.name || "Stage"}
                        {action === ISSUE_ACTION.CREATE && <span className="text-destructive ml-1">*</span>}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    {workflowStates
                      .filter((state) => {
                        // Hide "Done" (completed) state for assignees who are not reviewers
                        // Only reviewers can move issues to Done
                        if (state.type === 'completed' && isAssigneeNotReviewer && action === ISSUE_ACTION.EDIT) {
                          return false;
                        }
                        return true;
                      })
                      .map((state) => (
                        <DropdownMenuItem
                          key={state.id}
                          onClick={() => {
                            // Check if selecting Review state - need to pick reviewer first
                            const currentState = workflowStates.find(s => s.id === form.getValues("workflowStateId"));
                            const isMovingToReview = state.type === 'review' && currentState?.type !== 'review';
                            
                            if (isMovingToReview) {
                              // Store the pending state and show reviewer modal
                              setPendingReviewStateId(state.id);
                              setShowReviewerModal(true);
                              setStatusOpen(false);
                            } else {
                              // Normal status change
                              form.setValue("workflowStateId", state.id);
                              setSelectedReviewer(null); // Clear reviewer when moving away from review
                              setStatusOpen(false);
                            }
                          }}
                          className="flex items-center gap-2"
                        >
                          {getStatusIcon(state.type)}
                          <span className="flex-1">{state.name}</span>
                          {form.watch("workflowStateId") === state.id && (
                            <Check className="h-4 w-4 text-muted-foreground" />
                          )}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Priority Button */}
                <DropdownMenu
                  open={priorityOpen}
                  onOpenChange={setPriorityOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 gap-2"
                    >
                      <PriorityIcon priority={currentPriority} />
                      <span>
                        {currentPriority === "none"
                          ? "Priority"
                          : Object.entries({
                            none: "None",
                            low: "Low",
                            medium: "Medium",
                            high: "High",
                            urgent: "Urgent",
                          }).find(([val]) => val === currentPriority)?.[1] ||
                          "Priority"}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    {Object.entries({
                      none: "None",
                      low: "Low",
                      medium: "Medium",
                      high: "High",
                      urgent: "Urgent",
                    }).map(([value, label]) => (
                      <DropdownMenuItem
                        key={value}
                        onClick={() => {
                          form.setValue("priority", value as PriorityLevel);
                          setPriorityOpen(false);
                        }}
                        className="flex items-center gap-2"
                      >
                        <PriorityIcon priority={value as PriorityLevel} />
                        <span className="flex-1">{label}</span>
                        {currentPriority === value && (
                          <Check className="h-4 w-4 text-muted-foreground" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Assignees Button (Multiple) */}
                <DropdownMenu
                  open={assigneeOpen}
                  onOpenChange={setAssigneeOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-8 px-3 gap-2 relative",
                        selectedAssignees.length > 0 && "bg-primary/10 border-primary/20",
                        action === ISSUE_ACTION.CREATE && selectedAssignees.length === 0 && "border-dashed border-muted-foreground/50"
                      )}
                    >
                      <User className="h-4 w-4" />
                      <span>
                        {selectedAssignees.length > 0 
                          ? `${selectedAssignees.length} Assignee${selectedAssignees.length > 1 ? 's' : ''}`
                          : "Assignees"}
                        {action === ISSUE_ACTION.CREATE && <span className="text-destructive ml-1">*</span>}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64">
                    <div className="space-y-1">
                      {teamMembers.map((member) => {
                        const isSelected = selectedAssignees.includes(member.userId);
                        return (
                          <DropdownMenuItem
                            key={member.userId}
                            onClick={() => toggleAssignee(member.userId)}
                            className={cn(
                              "flex items-center gap-2 cursor-pointer",
                              isSelected &&
                              "bg-primary/10 border-l-2 border-l-primary",
                            )}
                          >
                            <UserAvatar
                              name={member.userName}
                              className="h-6 w-6"
                            />
                            <span
                              className={cn(
                                "flex-1",
                                isSelected && "font-medium",
                              )}
                            >
                              {member.userName}
                            </span>
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary font-bold" />
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Labels Button (Tag) */}
                <DropdownMenu open={labelsOpen} onOpenChange={setLabelsOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-8 px-3 gap-2 relative",
                        selectedLabels.length > 0 && "bg-primary/10 border-primary/20",
                        action === ISSUE_ACTION.CREATE && selectedLabels.length === 0 && "border-dashed border-muted-foreground/50"
                      )}
                    >
                      <Tag className="h-4 w-4" />
                      <span>
                        {selectedLabels.length > 0 ? `${selectedLabels.length} Tag${selectedLabels.length > 1 ? 's' : ''}` : 'Tag'}
                        {action === ISSUE_ACTION.CREATE && <span className="text-destructive ml-1">*</span>}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64">
                    {!currentProjectId ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        Please select a project first to view labels
                      </div>
                    ) : labels.length === 0 ? (
                      <div className="p-3 space-y-2">
                        <div className="text-sm text-muted-foreground text-center">
                          No labels found for this project
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            const selectedProjectId = form.getValues("projectId")
                            if (!teamId || !selectedProjectId) {
                              toast.error('Please select a project first')
                              setLabelsOpen(false)
                              return
                            }
                            setCreateLabelDialogOpen(true)
                            setLabelsOpen(false)
                          }}
                        >
                          <Tag className="h-4 w-4 mr-2" />
                          Create Label
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {labels.map((label) => {
                          const isSelected = selectedLabels.includes(label.id);
                          return (
                            <DropdownMenuItem
                              key={label.id}
                              onClick={() => toggleLabel(label.id)}
                              className={cn(
                                "flex items-center gap-2 cursor-pointer",
                                isSelected &&
                                "bg-primary/10 border-l-2 border-l-primary",
                              )}
                            >
                              <div
                                className={cn(
                                  "h-3 w-3 rounded-full",
                                  isSelected &&
                                  "ring-2 ring-primary ring-offset-1",
                                )}
                                style={{ backgroundColor: label.color }}
                              />
                              <span
                                className={cn(
                                  "flex-1",
                                  isSelected && "font-medium",
                                )}
                              >
                                {label.name}
                              </span>
                              {isSelected && (
                                <Check className="h-4 w-4 text-primary font-bold" />
                              )}
                            </DropdownMenuItem>
                          );
                        })}
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault()
                            const selectedProjectId = form.getValues("projectId")
                            if (!teamId || !selectedProjectId) {
                              toast.error('Please select a project first')
                              setLabelsOpen(false)
                              return
                            }
                            setCreateLabelDialogOpen(true)
                            setLabelsOpen(false)
                          }}
                          className="flex items-center gap-2 cursor-pointer border-t mt-1 pt-1"
                        >
                          <Tag className="h-4 w-4" />
                          <span>Create New Label</span>
                        </DropdownMenuItem>
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* More Options Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>

            {/* Sub-issues Section - Show when editing an issue */}
            {action === ISSUE_ACTION.EDIT && issue && (
              <div className="border-t px-6 py-4">
                {/* Parent Issue Info - always visible, clickable to navigate */}
                {issue.parent && (
                  <div className="mb-3">
                    <div className="text-xs text-muted-foreground mb-1">Parent Issue</div>
                    <div 
                      className="flex items-center gap-2 p-2 bg-muted/50 rounded-md hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => {
                        // Find full parent issue from allIssues
                        const parentIssue = allIssues.find(i => i.id === issue.parentId);
                        if (parentIssue && onSubIssueClick) {
                          onSubIssueClick(parentIssue);
                        }
                      }}
                    >
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-xs text-muted-foreground">#{issue.parent.number}</span>
                      <span className="text-sm truncate hover:text-primary">{issue.parent.title}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    </div>
                  </div>
                )}

                {/* Sub-issues Tree - Collapsible */}
                {(() => {
                  // Count only DIRECT children (not all descendants)
                  const directChildren = allIssues.filter(i => i.parentId === issue.id);
                  const directChildrenCompleted = directChildren.filter(
                    c => c.workflowState?.type === 'completed'
                  ).length;
                  const hasDirectChildren = directChildren.length > 0;

                  return (
                    <>
                      <div className="flex items-center gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => setShowSubIssues(!showSubIssues)}
                          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex-1"
                        >
                          <ChevronRight className={cn(
                            "h-4 w-4 transition-transform",
                            showSubIssues && "rotate-90"
                          )} />
                          Sub-work items
                          {hasDirectChildren && (
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
                              {directChildrenCompleted}/{directChildren.length} Done
                            </span>
                          )}
                        </button>
                        {onCreateSubIssue && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCreateSubIssue(issue.id);
                              onOpenChange(false);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        )}
                      </div>

                      {showSubIssues && (
                        <div className="mt-3">
                          {hasDirectChildren ? (
                            <SubIssueTree
                              parentId={issue.id}
                              allIssues={allIssues}
                              onIssueClick={(clickedIssue) => {
                                if (onSubIssueClick) {
                                  onSubIssueClick(clickedIssue);
                                }
                              }}
                            />
                          ) : (
                            <div className="text-xs text-muted-foreground text-center py-2">
                              No sub-issues yet
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Activity Log - Show when editing */}
            {action === ISSUE_ACTION.EDIT && issue && teamId && (
              <div className="border-t px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowActivity(!showActivity)}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  <ChevronRight className={cn(
                    "h-4 w-4 transition-transform",
                    showActivity && "rotate-90"
                  )} />
                  Activity
                  {activitiesData?.items && activitiesData.items.length > 0 && (
                    <span className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full ml-auto">
                      {activitiesData.items.length}
                    </span>
                  )}
                </button>
                {showActivity && (
                  <div className="mt-3">
                    <ActivityLog 
                      activities={activitiesData?.items || []} 
                      isLoading={activitiesLoading} 
                    />
                  </div>
                )}
              </div>
            )}

            {/* Review Actions - Show when issue is in Review state */}
            {action === ISSUE_ACTION.EDIT && issue && currentUserRole && teamId && currentUserId && (
              <div className="px-6">
                <ReviewActions
                  issue={issue}
                  workflowStates={workflowStates}
                  teamId={teamId}
                  currentUserId={currentUserId}
                  currentUserRole={currentUserRole}
                  onActionComplete={() => {
                    onIssueUpdate?.()
                    onOpenChange(false)
                  }}
                />
              </div>
            )}
            </div>

            {/* Footer - Fixed at bottom */}
            <div className="flex items-center justify-between px-6 py-4 border-t flex-shrink-0 bg-background">
              {action === ISSUE_ACTION.CREATE && (
                <span className="text-xs text-muted-foreground">
                  <span className="text-destructive">*</span> Required fields
                </span>
              )}
              {isLocked && (
                <span className="text-xs text-amber-500 flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  Use Review Actions above to manage this issue
                </span>
              )}
              <div className={cn("flex items-center gap-3", (action !== ISSUE_ACTION.CREATE && !isLocked) && "ml-auto")}>
                {action === ISSUE_ACTION.CREATE && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Create more
                    </span>
                    <button
                      type="button"
                      onClick={() => setCreateMore(!createMore)}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        createMore ? "bg-primary" : "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          createMore ? "translate-x-5" : "translate-x-0.5",
                        )}
                      />
                    </button>
                  </div>
                )}
                {!isLocked && (
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    onClick={async () => {
                      const data = form.getValues();
                      await handleSubmit(data);
                    }}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isSubmitting
                      ? action === ISSUE_ACTION.EDIT
                        ? "Updating..."
                        : "Creating..."
                      : action === ISSUE_ACTION.EDIT
                        ? "Update Issue"
                        : "Create issue"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {/* Label Creation Dialog - Outside main dialog to avoid z-index issues */}
    {teamId && (
      <LabelDialog
        open={createLabelDialogOpen}
        onOpenChange={(open) => {
          setCreateLabelDialogOpen(open)
          // Don't reset anything when closing
        }}
        onSubmit={async (data) => {
          // Get the current projectId from the form at submit time (most reliable)
          const projectId = form.getValues("projectId")
          
          if (!projectId) {
            toast.error('Please select a project first')
            setCreateLabelDialogOpen(false)
            return
          }
          
          try {
            const response = await fetch(`/api/teams/${teamId}/projects/${projectId}/labels`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            })
            
            if (!response.ok) throw new Error('Failed to create label')
            
            const newLabel = await response.json()
            
            // Auto-select the newly created label
            setSelectedLabels((prev) => {
              if (!prev.includes(newLabel.id)) {
                return [...prev, newLabel.id]
              }
              return prev
            })
            
            toast.success('Label created and selected')
            // Refresh labels by invalidating query
            queryClient.invalidateQueries({ queryKey: ['labels', teamId, projectId] })
            setCreateLabelDialogOpen(false)
          } catch (error) {
            toast.error('Failed to create label')
            throw error
          }
        }}
        teamId={teamId}
        projectId={form.watch("projectId") || ''}
      />
    )}

    {/* Reviewer Selection Modal - Shows when moving to Review state */}
    {teamId && (
      <ReviewerSelectModal
        open={showReviewerModal}
        onOpenChange={setShowReviewerModal}
        teamId={teamId}
        excludeUserIds={selectedAssignees} // Assignees can't review their own work
        onSelect={(reviewerId, reviewerName) => {
          // Set the reviewer and update the workflow state
          setSelectedReviewer({ id: reviewerId, name: reviewerName });
          if (pendingReviewStateId) {
            form.setValue("workflowStateId", pendingReviewStateId);
          }
          setPendingReviewStateId(null);
          setShowReviewerModal(false);
          toast.success(`Reviewer set to ${reviewerName}`);
        }}
        onCancel={() => {
          setPendingReviewStateId(null);
          setShowReviewerModal(false);
        }}
      />
    )}
  </>
  );
}
