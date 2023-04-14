CREATE TABLE "ttl_test" (
    id SERIAL PRIMARY KEY,
    inserted_at TIMESTAMP default current_timestamp()
) WITH (ttl_expire_after = '3 months');