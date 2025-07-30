SELECT
  YEAR(createdAt) AS `year`,
  COUNT(*) AS `count`
FROM
  User
GROUP BY
  `year`