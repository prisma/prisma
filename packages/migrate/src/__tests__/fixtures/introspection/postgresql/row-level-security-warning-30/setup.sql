-- Create a test table
CREATE TABLE foo (
    id SERIAL PRIMARY KEY,
    -- We use this row to add security
    owner VARCHAR(30) NOT NULL
);

ALTER TABLE foo ENABLE ROW LEVEL SECURITY; 