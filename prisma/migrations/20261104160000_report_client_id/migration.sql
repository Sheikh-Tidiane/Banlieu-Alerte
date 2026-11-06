-- AlterTable
ALTER TABLE `reports` ADD COLUMN `clientId` VARCHAR(36) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `reports_clientId_key` ON `reports`(`clientId`);

