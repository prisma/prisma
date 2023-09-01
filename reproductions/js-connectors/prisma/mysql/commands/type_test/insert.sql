INSERT INTO type_test (
    tinyint_column,
    smallint_column,
    mediumint_column,
    int_column,
    bigint_column,
    float_column,
    double_column,
    decimal_column,
    boolean_column,
    bit_column,
    char_column,
    varchar_column,
    text_column,
    date_column,
    time_column,
    year_column,
    datetime_column,
    timestamp_column,
    json_column,
    enum_column,
    binary_column,
    varbinary_column,
    blob_column,
    set_column
) VALUES (
    127, -- tinyint
    32767, -- smallint
    8388607, -- mediumint
    2147483647, -- int
    9223372036854775807, -- bigint
    3.402823466, -- float
    1.7976931348623157, -- double
    99999999.99, -- decimal
    TRUE, -- boolean
    1, -- bit
    'c', -- char
    'Sample varchar', -- varchar
    'This is a long text...', -- text
    '2023-07-24', -- date
    '23:59:59', -- time
    2023, -- year
    '2023-07-24 23:59:59.415', -- datetime
    '2023-07-24 23:59:59', -- timestamp
    '{"key": "value"}', -- json
    'value3', -- enum
    0x4D7953514C, -- binary
    0x48656C6C6F20, -- varbinary
    _binary 'binary', -- blob
    'option1,option3' -- set
);
