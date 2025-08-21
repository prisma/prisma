SELECT "variant", CAST("checked_out" AS FLOAT) / CAST("opened" AS FLOAT) AS "conversion"
FROM (
  SELECT
    "variant",
    COUNT(*) FILTER (WHERE "type"='PageOpened') AS "opened",
    COUNT(*) FILTER (WHERE "type"='CheckedOut') AS "checked_out"
  FROM "TrackingEvent"
  GROUP BY "variant"
) AS "counts"
ORDER BY "conversion" DESC
