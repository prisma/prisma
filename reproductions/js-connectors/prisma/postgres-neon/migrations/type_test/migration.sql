INSERT INTO type_test (
    smallint_column,
    int_column,
    bigint_column,
    float_column,
    double_column,
    decimal_column,
    boolean_column,
    char_column,
    varchar_column,
    text_column,
    date_column,
    time_column,
    datetime_column,
    timestamp_column,
    json_column,
    enum_column
) VALUES (
    32767, -- smallint
    2147483647, -- int
    9223372036854775807, -- bigint
    3.402823466, -- float
    1.7976931348623157, -- double
    99999999.99, -- decimal
    TRUE, -- boolean
    'c', -- char
    'Sample varchar', -- varchar
    'This is a long text...', -- text
    '2023-07-24', -- date
    '23:59:59', -- time
    '2023-07-24 23:59:59', -- datetime
    '2023-07-24 23:59:59', -- timestamp
    '{"key": "value"}', -- json
    'value3' -- enum
);
