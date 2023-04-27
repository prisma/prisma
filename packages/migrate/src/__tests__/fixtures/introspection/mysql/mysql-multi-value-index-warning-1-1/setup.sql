CREATE TABLE customers
(
    id       INT AUTO_INCREMENT PRIMARY KEY,
    custinfo JSON,
    INDEX zips ((CAST(custinfo -> '$.zipcode' AS UNSIGNED ARRAY)))
);
