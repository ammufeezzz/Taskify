import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/auth-server-helpers'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await getUserId() // Ensure user is authenticated

    // Get all issues with their workflow states to determine completion
    const allIssues = await db.issue.findMany({
      where: { teamId },
      include: {
        workflowState: true
      }
    })

    // Get other data
    const [members, projects, labels, recentIssues] = await Promise.all([
      // Team members
      db.teamMember.count({
        where: { teamId }
      }),
      
      // Active projects
      db.project.count({
        where: {
          teamId,
          status: 'active'
        }
      }),
      
      // Labels - count across all projects in the team (labels are now project-specific)
      db.label.count({
        where: {
          project: {
            teamId
          }
        }
      }),
      
      // Recent issues (last 7 days) for activity
      db.issue.findMany({
        where: {
          teamId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          createdAt: true
        }
      })
    ])

    // Calculate completed issues based on workflow state type
    const issues = allIssues.length
    const completedIssues = allIssues.filter(issue => 
      issue.workflowState.type === 'completed'
    ).length

    // Calculate completion rate
    const completionRate = issues > 0 
      ? Math.round((completedIssues / issues) * 100) 
      : 0

    // Issues by priority
    const issuesByPriority = allIssues.reduce((acc, issue) => {
      acc[issue.priority] = (acc[issue.priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Issues by status (workflow state)
    const statusCounts = allIssues.reduce((acc, issue) => {
      const status = issue.workflowState.name
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      stats: {
        members,
        projects,
        totalIssues: issues,
        completedIssues,
        completionRate,
        labels
      },
      priorityBreakdown: Object.entries(issuesByPriority).map(([priority, count]) => ({
        priority,
        count: count as number
      })),
      statusBreakdown: Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count
      })),
      recentIssues
    })
  } catch (error) {
    console.error('Error fetching team stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team statistics' },
      { status: 500 }
    )
  }
}

