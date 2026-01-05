-- Move labels from team-level to project-level
-- Step 1: Delete all issue-label relationships (clean slate)
DELETE FROM "issue_labels";

-- Step 2: Delete all existing labels (clean slate)
DELETE FROM "labels";

-- Step 3: Drop old foreign key constraint
ALTER TABLE "labels" DROP CONSTRAINT IF EXISTS "labels_teamId_fkey";

-- Step 4: Drop old unique constraint
ALTER TABLE "labels" DROP CONSTRAINT IF EXISTS "labels_teamId_name_key";

-- Step 5: Drop old teamId column
ALTER TABLE "labels" DROP COLUMN IF EXISTS "teamId";

-- Step 6: Add new projectId column (nullable first, will be made required after data migration)
ALTER TABLE "labels" ADD COLUMN "projectId" TEXT;

-- Step 7: Make projectId required (NOT NULL)
ALTER TABLE "labels" ALTER COLUMN "projectId" SET NOT NULL;

-- Step 8: Add new foreign key constraint to projects
ALTER TABLE "labels" ADD CONSTRAINT "labels_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 9: Add new unique constraint on projectId and name
ALTER TABLE "labels" ADD CONSTRAINT "labels_projectId_name_key" UNIQUE ("projectId", "name");



