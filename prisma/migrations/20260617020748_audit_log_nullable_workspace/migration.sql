-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_workspace_id_fkey";

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "workspace_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
