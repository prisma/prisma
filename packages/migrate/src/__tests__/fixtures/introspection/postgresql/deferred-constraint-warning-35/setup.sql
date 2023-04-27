CREATE TABLE a (
    id INT,
    foo INT,
    bar INT
);

CREATE TABLE b (
    id INT PRIMARY KEY
);

ALTER TABLE a
    ADD CONSTRAINT a_b_fk
    FOREIGN KEY (foo) REFERENCES b(id)
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE a
    ADD CONSTRAINT foo_key
    UNIQUE(foo)
    DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE a
    ADD CONSTRAINT foo_pkey
    PRIMARY KEY (id)
    DEFERRABLE INITIALLY DEFERRED;