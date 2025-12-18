
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔍 Checking database schema...')

    try {
        // Get a valid team ID and workflow state ID
        const team = await prisma.team.findFirst()
        if (!team) {
            console.error('❌ No team found. Run seed first.')
            process.exit(1)
        }

        const workflowState = await prisma.workflowState.findFirst({
            where: { teamId: team.id }
        })

        if (!workflowState) {
            console.error('❌ No workflow state found.')
            process.exit(1)
        }

        // Try to create an issue with the new fields
        // If the types are wrong in the generated client, this might fail compilation or runtime
        console.log('📝 Attempting to create issue with new fields...')

        // We explicitly cast to any to bypass TS checks if the editor is using old types, 
        // but the runtime execution uses the actual client.
        // However, if we want to check if the CLIENT has the fields, we should trust the runtime assignment.

        const issue = await prisma.issue.create({
            data: {
                title: 'Test Issue ' + Date.now(),
                teamId: team.id,
                workflowStateId: workflowState.id,
                creatorId: 'debug-user',
                creator: 'Debug User',
                number: 99999, // manual number
                difficulty: 'M',
                dueDate: new Date(),
            } as any
        })

        console.log('✅ Issue created successfully with ID:', issue.id)
        console.log('Data:', issue)

        // Verify fields were saved
        if ((issue as any).difficulty === 'M' && (issue as any).dueDate) {
            console.log('✅ New fields verified in response.')
        } else {
            console.warn('⚠️ New fields mismatch or missing in response.')
        }

        // Clean up
        await prisma.issue.delete({ where: { id: issue.id } })

    } catch (error) {
        console.error('❌ Error:', error)
        process.exit(1)
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
