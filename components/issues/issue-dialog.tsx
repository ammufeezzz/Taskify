"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
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
import {
  Circle,
  MoreHorizontal,
  User,
  Settings,
  Tag,
  MoreVertical,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ISSUE_ACTION } from "@/app/dashboard/[teamId]/issues/page";
import { toast } from "sonner";

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
}

export function IssueDialog({
  open,
  onOpenChange,
  onSubmit,
  projects,
  workflowStates,
  labels,
  initialData,
  description = "Create a new issue for your team.",
  teamId,
  teamName,
  action,
  currentUserId,
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
    },
  });

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
  }, [isSubmitting, open, initialData, form, workflowStates, action, currentUserId, createMore]);

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
        };
        await onSubmit(submitData);
      }

      form.reset(formReset);
      setSelectedLabels([]);
      setSelectedAssignees(action === ISSUE_ACTION.CREATE && currentUserId ? [currentUserId] : []);
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
  const currentProjectId = form.watch("projectId");
  const currentProject = projects.find((p) => p.id === currentProjectId);
  const selectedLabelsData = labels.filter((l) =>
    selectedLabels.includes(l.id),
  );

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[700px] p-0 gap-0 [&>button]:hidden"
        onEscapeKeyDown={() => {
          form.reset(formReset);
        }}
        onInteractOutside={() => {
          form.reset(formReset);
        }}
      >
        {/* Custom Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
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

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col h-full"
          >
            <div className="flex-1 px-6 py-4 space-y-4">
              {/* Title Input */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder={action === ISSUE_ACTION.CREATE ? "Issue title *" : "Issue title"}
                        className="text-lg font-medium border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto py-2"
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
                        className="border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none min-h-[100px] text-muted-foreground"
                        {...field}
                        onKeyDown={async (e) => {
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="flex items-center gap-2 flex-wrap">
                {/* Project Button */}
                <DropdownMenu open={projectOpen} onOpenChange={setProjectOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
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
                    {workflowStates.map((state) => (
                      <DropdownMenuItem
                        key={state.id}
                        onClick={() => {
                          form.setValue("workflowStateId", state.id);
                          setStatusOpen(false);
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
                    </div>
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
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t">
              {action === ISSUE_ACTION.CREATE && (
                <span className="text-xs text-muted-foreground">
                  <span className="text-destructive">*</span> Required fields
                </span>
              )}
              <div className={cn("flex items-center gap-3", action !== ISSUE_ACTION.CREATE && "ml-auto")}>
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
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
