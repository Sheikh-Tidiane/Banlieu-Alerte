-- AlterTable
ALTER TABLE `reports` ADD COLUMN `escalatedAt` DATETIME(3) NULL,
    ADD COLUMN `escalationLevel` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `resolutionFeedback` ENUM('CONFIRMED', 'REOPENED') NULL,
    ADD COLUMN `resolutionFeedbackAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `notifyStatusChanges` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `rain_episodes` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `observedRainMm` DECIMAL(6, 1) NULL,
    `status` ENUM('OPEN', 'VALIDATED') NOT NULL DEFAULT 'OPEN',
    `validatedAt` DATETIME(3) NULL,
    `validatedById` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `rain_episodes_startsAt_idx`(`startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `episode_labels` (
    `id` VARCHAR(191) NOT NULL,
    `episodeId` VARCHAR(191) NOT NULL,
    `cellId` VARCHAR(191) NOT NULL,
    `label` ENUM('FLOODED', 'NOT_FLOODED', 'UNKNOWN') NOT NULL,
    `note` VARCHAR(500) NULL,
    `labeledById` VARCHAR(191) NOT NULL,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `episode_labels_episodeId_cellId_key`(`episodeId`, `cellId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `episode_label_history` (
    `id` VARCHAR(191) NOT NULL,
    `labelId` VARCHAR(191) NOT NULL,
    `fromLabel` ENUM('FLOODED', 'NOT_FLOODED', 'UNKNOWN') NULL,
    `toLabel` ENUM('FLOODED', 'NOT_FLOODED', 'UNKNOWN') NOT NULL,
    `changedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `episode_label_history_labelId_idx`(`labelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feedback_prompts` (
    `id` VARCHAR(191) NOT NULL,
    `episodeId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `neighborhoodId` VARCHAR(191) NULL,
    `answer` ENUM('FLOODED', 'NOT_FLOODED', 'DONT_KNOW') NULL,
    `answeredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `feedback_prompts_episodeId_userId_key`(`episodeId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_notifications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `kind` ENUM('REPORT_STATUS', 'RESOLUTION_CHECK', 'ESCALATION', 'EPISODE_FEEDBACK') NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `body` TEXT NULL,
    `link` VARCHAR(300) NULL,
    `reportId` VARCHAR(191) NULL,
    `episodeId` VARCHAR(191) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_notifications_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `escalation_rules` (
    `id` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(40) NOT NULL,
    `type` ENUM('FLOODING', 'BLOCKED_DRAIN', 'WASTE_DUMP', 'ROAD_CUT', 'OTHER') NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH') NULL,
    `targetHours` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `escalation_rules_scope_key`(`scope`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cleanup_operations` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `team` VARCHAR(160) NOT NULL,
    `status` ENUM('PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'PLANNED',
    `plannedFor` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `note` VARCHAR(1000) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `cleanup_operations_status_idx`(`status`),
    INDEX `cleanup_operations_reportId_idx`(`reportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cleanup_photos` (
    `id` VARCHAR(191) NOT NULL,
    `operationId` VARCHAR(191) NOT NULL,
    `phase` ENUM('BEFORE', 'AFTER') NOT NULL,
    `storageKey` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(40) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rain_episodes` ADD CONSTRAINT `rain_episodes_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rain_episodes` ADD CONSTRAINT `rain_episodes_validatedById_fkey` FOREIGN KEY (`validatedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `episode_labels` ADD CONSTRAINT `episode_labels_episodeId_fkey` FOREIGN KEY (`episodeId`) REFERENCES `rain_episodes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `episode_labels` ADD CONSTRAINT `episode_labels_cellId_fkey` FOREIGN KEY (`cellId`) REFERENCES `risk_cells`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `episode_labels` ADD CONSTRAINT `episode_labels_labeledById_fkey` FOREIGN KEY (`labeledById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `episode_label_history` ADD CONSTRAINT `episode_label_history_labelId_fkey` FOREIGN KEY (`labelId`) REFERENCES `episode_labels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `episode_label_history` ADD CONSTRAINT `episode_label_history_changedById_fkey` FOREIGN KEY (`changedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback_prompts` ADD CONSTRAINT `feedback_prompts_episodeId_fkey` FOREIGN KEY (`episodeId`) REFERENCES `rain_episodes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback_prompts` ADD CONSTRAINT `feedback_prompts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feedback_prompts` ADD CONSTRAINT `feedback_prompts_neighborhoodId_fkey` FOREIGN KEY (`neighborhoodId`) REFERENCES `neighborhoods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_notifications` ADD CONSTRAINT `user_notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_notifications` ADD CONSTRAINT `user_notifications_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `reports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cleanup_operations` ADD CONSTRAINT `cleanup_operations_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `reports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cleanup_operations` ADD CONSTRAINT `cleanup_operations_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cleanup_photos` ADD CONSTRAINT `cleanup_photos_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `cleanup_operations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

