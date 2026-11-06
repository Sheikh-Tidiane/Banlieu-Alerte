-- CreateTable
CREATE TABLE `risk_cells` (
    `id` VARCHAR(191) NOT NULL,
    `row` INTEGER NOT NULL,
    `col` INTEGER NOT NULL,
    `centerLat` DECIMAL(9, 6) NOT NULL,
    `centerLng` DECIMAL(9, 6) NOT NULL,
    `sizeMeters` INTEGER NOT NULL,
    `elevationMeters` DECIMAL(7, 2) NULL,
    `relativeElevation` DECIMAL(6, 2) NULL,
    `slopePercent` DECIMAL(6, 2) NULL,
    `elevationSource` VARCHAR(160) NULL,
    `neighborhoodId` VARCHAR(191) NULL,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `risk_cells_centerLat_centerLng_idx`(`centerLat`, `centerLng`),
    INDEX `risk_cells_neighborhoodId_idx`(`neighborhoodId`),
    UNIQUE INDEX `risk_cells_row_col_key`(`row`, `col`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `weather_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `lat` DECIMAL(8, 4) NOT NULL,
    `lng` DECIMAL(8, 4) NOT NULL,
    `source` VARCHAR(80) NOT NULL,
    `hourly` JSON NOT NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isDemo` BOOLEAN NOT NULL DEFAULT false,

    INDEX `weather_snapshots_fetchedAt_idx`(`fetchedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rule_versions` (
    `id` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `notes` TEXT NULL,
    `params` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `activatedAt` DATETIME(3) NULL,

    UNIQUE INDEX `rule_versions_number_key`(`number`),
    INDEX `rule_versions_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `risk_runs` (
    `id` VARCHAR(191) NOT NULL,
    `ruleVersionId` VARCHAR(191) NOT NULL,
    `weatherSnapshotId` VARCHAR(191) NULL,
    `weatherStale` BOOLEAN NOT NULL DEFAULT false,
    `cellCount` INTEGER NOT NULL DEFAULT 0,
    `draftsCreated` INTEGER NOT NULL DEFAULT 0,
    `trigger` VARCHAR(20) NOT NULL,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `risk_runs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `risk_predictions` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `scope` ENUM('CELL', 'NEIGHBORHOOD') NOT NULL,
    `cellId` VARCHAR(191) NULL,
    `neighborhoodId` VARCHAR(191) NULL,
    `horizonHours` INTEGER NOT NULL,
    `score` INTEGER NULL,
    `level` ENUM('LOW', 'MODERATE', 'HIGH', 'CRITICAL') NULL,
    `factors` JSON NOT NULL,
    `ruleVersionId` VARCHAR(191) NOT NULL,
    `weatherFetchedAt` DATETIME(3) NULL,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `risk_predictions_runId_scope_horizonHours_idx`(`runId`, `scope`, `horizonHours`),
    INDEX `risk_predictions_neighborhoodId_createdAt_idx`(`neighborhoodId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alerts` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('OFFICIAL', 'INDICATIVE') NOT NULL,
    `status` ENUM('PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'SENT', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_APPROVAL',
    `origin` ENUM('MANUAL', 'RISK_INDEX') NOT NULL DEFAULT 'MANUAL',
    `level` ENUM('LOW', 'MODERATE', 'HIGH', 'CRITICAL') NOT NULL,
    `issuerName` VARCHAR(160) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `messageFr` TEXT NOT NULL,
    `messageWo` TEXT NULL,
    `woReviewed` BOOLEAN NOT NULL DEFAULT false,
    `advice` TEXT NULL,
    `validFrom` DATETIME(3) NOT NULL,
    `validUntil` DATETIME(3) NOT NULL,
    `scheduledAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `riskPredictionId` VARCHAR(191) NULL,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `alerts_status_validUntil_idx`(`status`, `validUntil`),
    INDEX `alerts_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert_neighborhoods` (
    `alertId` VARCHAR(191) NOT NULL,
    `neighborhoodId` VARCHAR(191) NOT NULL,

    INDEX `alert_neighborhoods_neighborhoodId_idx`(`neighborhoodId`),
    PRIMARY KEY (`alertId`, `neighborhoodId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert_approvals` (
    `id` VARCHAR(191) NOT NULL,
    `alertId` VARCHAR(191) NOT NULL,
    `approverId` VARCHAR(191) NOT NULL,
    `decision` ENUM('APPROVED', 'REJECTED') NOT NULL,
    `reason` VARCHAR(500) NULL,
    `changes` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `alert_approvals_alertId_idx`(`alertId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert_deliveries` (
    `id` VARCHAR(191) NOT NULL,
    `alertId` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `channel` ENUM('IN_APP', 'WEB_PUSH') NOT NULL,
    `status` ENUM('DELIVERED', 'SIMULATED', 'FAILED') NOT NULL,
    `mode` VARCHAR(20) NOT NULL,
    `locale` VARCHAR(5) NOT NULL,
    `error` VARCHAR(500) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `alert_deliveries_userId_createdAt_idx`(`userId`, `createdAt`),
    UNIQUE INDEX `alert_deliveries_alertId_subscriptionId_channel_key`(`alertId`, `subscriptionId`, `channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `lat` DECIMAL(9, 6) NULL,
    `lng` DECIMAL(9, 6) NULL,
    `radiusMeters` INTEGER NULL,
    `minLevel` ENUM('LOW', 'MODERATE', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MODERATE',
    `locale` VARCHAR(5) NOT NULL DEFAULT 'fr',
    `channelInApp` BOOLEAN NOT NULL DEFAULT true,
    `channelWebPush` BOOLEAN NOT NULL DEFAULT false,
    `isDemo` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `subscriptions_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_neighborhoods` (
    `subscriptionId` VARCHAR(191) NOT NULL,
    `neighborhoodId` VARCHAR(191) NOT NULL,

    INDEX `subscription_neighborhoods_neighborhoodId_idx`(`neighborhoodId`),
    PRIMARY KEY (`subscriptionId`, `neighborhoodId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `risk_cells` ADD CONSTRAINT `risk_cells_neighborhoodId_fkey` FOREIGN KEY (`neighborhoodId`) REFERENCES `neighborhoods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rule_versions` ADD CONSTRAINT `rule_versions_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_runs` ADD CONSTRAINT `risk_runs_ruleVersionId_fkey` FOREIGN KEY (`ruleVersionId`) REFERENCES `rule_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_runs` ADD CONSTRAINT `risk_runs_weatherSnapshotId_fkey` FOREIGN KEY (`weatherSnapshotId`) REFERENCES `weather_snapshots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_predictions` ADD CONSTRAINT `risk_predictions_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `risk_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_predictions` ADD CONSTRAINT `risk_predictions_cellId_fkey` FOREIGN KEY (`cellId`) REFERENCES `risk_cells`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_predictions` ADD CONSTRAINT `risk_predictions_neighborhoodId_fkey` FOREIGN KEY (`neighborhoodId`) REFERENCES `neighborhoods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `risk_predictions` ADD CONSTRAINT `risk_predictions_ruleVersionId_fkey` FOREIGN KEY (`ruleVersionId`) REFERENCES `rule_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_riskPredictionId_fkey` FOREIGN KEY (`riskPredictionId`) REFERENCES `risk_predictions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_neighborhoods` ADD CONSTRAINT `alert_neighborhoods_alertId_fkey` FOREIGN KEY (`alertId`) REFERENCES `alerts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_neighborhoods` ADD CONSTRAINT `alert_neighborhoods_neighborhoodId_fkey` FOREIGN KEY (`neighborhoodId`) REFERENCES `neighborhoods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_approvals` ADD CONSTRAINT `alert_approvals_alertId_fkey` FOREIGN KEY (`alertId`) REFERENCES `alerts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_approvals` ADD CONSTRAINT `alert_approvals_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_deliveries` ADD CONSTRAINT `alert_deliveries_alertId_fkey` FOREIGN KEY (`alertId`) REFERENCES `alerts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_deliveries` ADD CONSTRAINT `alert_deliveries_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_deliveries` ADD CONSTRAINT `alert_deliveries_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_neighborhoods` ADD CONSTRAINT `subscription_neighborhoods_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_neighborhoods` ADD CONSTRAINT `subscription_neighborhoods_neighborhoodId_fkey` FOREIGN KEY (`neighborhoodId`) REFERENCES `neighborhoods`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

