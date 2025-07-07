-- Reset database
DROP SCHEMA IF EXISTS `transactional`;
DROP SCHEMA IF EXISTS `base`;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS `base`;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS `transactional`;

-- CreateTable
CREATE TABLE `base`.`user` (
    `id` INT NOT NULL,
    `email` TEXT NOT NULL,

    CONSTRAINT `user_pkey` PRIMARY KEY (`id`)
);

-- CreateTable
CREATE TABLE `transactional`.`post` (
    `id` INT NOT NULL,
    `title` TEXT NOT NULL,
    `authorId` INT NOT NULL,
    `status` ENUM('ON', 'OFF') NOT NULL,

    CONSTRAINT `post_pkey` PRIMARY KEY (`id`)
);

-- AddForeignKey
ALTER TABLE `transactional`.`post` ADD CONSTRAINT `post_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `base`.`user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `base`.`some_table` (
    `id` INT NOT NULL,
    `email` TEXT NOT NULL,

    CONSTRAINT `user_pkey2` PRIMARY KEY (`id`)
);

-- CreateTable
CREATE TABLE `transactional`.`some_table` (
    `id` INT NOT NULL,
    `title` TEXT NOT NULL,
    `authorId` INT NOT NULL,
    `status` ENUM('ON', 'OFF') NOT NULL,

    CONSTRAINT `post_pkey2` PRIMARY KEY (`id`)
);

-- AddForeignKey
ALTER TABLE `transactional`.`some_table` ADD CONSTRAINT `post_authorId_fkey2` FOREIGN KEY (`authorId`) REFERENCES `base`.`some_table`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
