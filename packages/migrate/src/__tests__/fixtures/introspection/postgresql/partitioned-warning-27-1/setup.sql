CREATE TABLE measurement (
    city_id         int,
    logdate         date,
    peaktemp        int,
    unitsales       int
) PARTITION BY RANGE (logdate);

-- separate primary key addition because Pg10
ALTER TABLE measurement ADD PRIMARY KEY (city_id);

CREATE TABLE measurement_y2019m01 PARTITION OF measurement
    FOR VALUES FROM ('2019-01-01') TO ('2019-02-01');

CREATE TABLE measurement_y2019m02 PARTITION OF measurement
    FOR VALUES FROM ('2019-02-01') TO ('2019-03-01');

CREATE TABLE measurement_y2019m03 PARTITION OF measurement
    FOR VALUES FROM ('2019-03-01') TO ('2019-04-01');
