INSERT INTO type_test (
    int_column,
    bigint_column,
    double_column,
    decimal_column,
    boolean_column,
    text_column,
    datetime_column
) VALUES (
    2147483647, -- int
    9223372036854775807, -- bigint
    1.7976931348623157, -- double
    99999999.99, -- decimal
    TRUE, -- boolean
    'This is a long text...', -- text
    '2023-07-24 23:59:59.415' -- datetime
);
