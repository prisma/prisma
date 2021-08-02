DROP TABLE IF EXISTS [dbo].[jobs];

CREATE TABLE [dbo].[jobs] (
    [job_id] int IDENTITY,
    [customer_id] int,
    [description] varchar(200),
    [created_at] datetime2(7),
    PRIMARY KEY ([job_id])
);
