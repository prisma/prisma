create table reservations(
  id int primary key,
  room varchar not null,
  dates daterange not null 
);

create view res as select id, room, dates from reservations;
