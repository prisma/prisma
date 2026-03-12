SELECT
  DAY(createdAt) AS `day`,
  COUNT(*) AS `count`
FROM
  User
GROUP BY
  `day`