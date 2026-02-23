SELECT
  MONTH(createdAt) AS `month`,
  COUNT(*) AS `count`
FROM
  User
GROUP BY
  `month`