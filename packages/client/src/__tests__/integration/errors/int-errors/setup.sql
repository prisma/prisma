DROP TABLE IF EXISTS `User`;
CREATE TABLE `User` (
    `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
    `email` text COLLATE utf8mb4_unicode_ci NOT NULL,
    `name` text COLLATE utf8mb4_unicode_ci,
    `age` tinyint unsigned DEFAULT NULL,
    PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
INSERT INTO `User` (`age`, `email`, `id`, `name`)
VALUES (
        NULL,
        'a@a.de',
        '576eddf9-2434-421f-9a86-58bede16fd95',
        'Alice'
    );