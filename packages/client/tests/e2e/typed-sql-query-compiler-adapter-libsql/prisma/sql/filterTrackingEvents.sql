-- @param {String} $1:types
-- @param {String} $2:variants
SELECT te."id", te."type", te."variant"
FROM "TrackingEvent" te
WHERE
  ($1 IS NULL OR te."type" IN (SELECT value FROM json_each($1)))
  AND ($2 IS NULL OR te."variant" IN (SELECT value FROM json_each($2)))
