CREATE TABLE measurement (
    city_id         int not null,
    logdate         date not null,
    peaktemp        int,
    unitsales       int
) PARTITION BY RANGE (logdate);

CREATE TABLE measurement_y2019m01 PARTITION OF measurement
    FOR VALUES FROM ('2019-01-01') TO ('2019-02-01');

CREATE TABLE measurement_y2019m02 PARTITION OF measurement
    FOR VALUES FROM ('2019-02-01') TO ('2019-03-01');

CREATE TABLE measurement_y2019m03 PARTITION OF measurement
    FOR VALUES FROM ('2019-03-01') TO ('2019-04-01');

CREATE TABLE definitely_not_measurement (
    city_id         int not null,
    logdate         date not null,
    peaktemp        int,
    unitsales       int
) PARTITION BY RANGE (logdate);

CREATE TABLE definitely_not_measurement_y2019m01 PARTITION OF definitely_not_measurement
    FOR VALUES FROM ('2019-01-01') TO ('2019-02-01');