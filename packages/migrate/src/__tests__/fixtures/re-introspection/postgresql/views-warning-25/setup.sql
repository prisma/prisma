-- TODO: remove tmp table once we no longer receive error P4001
create table tmp(
  id int primary key
);

CREATE VIEW "B" AS SELECT 1 AS a, 2 AS b;