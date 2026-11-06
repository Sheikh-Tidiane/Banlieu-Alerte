-- AlterTable
ALTER TABLE `reports` ADD COLUMN `simulationRunId` VARCHAR(40) NULL;

-- AlterTable
ALTER TABLE `sessions` ADD COLUMN `mfaVerifiedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `totpEnabledAt` DATETIME(3) NULL,
    ADD COLUMN `totpLastStep` INTEGER NULL,
    ADD COLUMN `totpSecret` TEXT NULL;

-- CreateTable
CREATE TABLE `recovery_codes` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(64) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `recovery_codes_codeHash_key`(`codeHash`),
    INDEX `recovery_codes_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_runs` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(40) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `ok` BOOLEAN NULL,
    `summary` JSON NULL,
    `error` VARCHAR(500) NULL,

    INDEX `job_runs_name_startedAt_idx`(`name`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `recovery_codes` ADD CONSTRAINT `recovery_codes_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

