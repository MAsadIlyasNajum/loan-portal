-- CreateTable
CREATE TABLE `credit_check_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `applicationId` VARCHAR(191) NOT NULL,
    `status` ENUM('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `scheduledFor` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 5,
    `outcome` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NULL,
    `lastError` TEXT NULL,
    `lockedAt` DATETIME(3) NULL,
    `lockedBy` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `credit_check_jobs_applicationId_key`(`applicationId`),
    INDEX `credit_check_jobs_status_scheduledFor_idx`(`status`, `scheduledFor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `credit_check_jobs` ADD CONSTRAINT `credit_check_jobs_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `loan_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
