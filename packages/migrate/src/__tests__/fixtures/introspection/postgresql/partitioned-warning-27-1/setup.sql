CREATE TABLE measurement (
    city_id         int not null,
    logdate         date primary key,
    peaktemp        int,
    unitsales       int
) PARTITION BY RANGE (logdate);

CREATE TABLE measurement_y2019m01 PARTITION OF measurement
    FOR VALUES FROM ('2019-01-01') TO ('2019-02-01');

CREATE TABLE measurement_y2019m02 PARTITION OF measurement
    FOR VALUES FROM ('2019-02-01') TO ('2019-03-01');

CREATE TABLE measurement_y2019m03 PARTITION OF measurement
    FOR VALUES FROM ('2019-03-01') TO ('2019-04-01');
