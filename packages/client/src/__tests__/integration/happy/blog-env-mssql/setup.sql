DROP TABLE IF EXISTS [Post]
DROP TABLE IF EXISTS [User]

CREATE TABLE [dbo].[User] ([id] nvarchar(1000)  NOT NULL ,
[email] nvarchar(1000)  NOT NULL ,
[name] nvarchar(1000)  ,
CONSTRAINT PK_User_id PRIMARY KEY ([id]),
CONSTRAINT User_email_unique UNIQUE ([email]))


CREATE TABLE [dbo].[Post] ([id] nvarchar(1000)  NOT NULL ,
[createdAt] datetime2  NOT NULL DEFAULT CURRENT_TIMESTAMP,
[updatedAt] datetime2  NOT NULL ,
[published] bit  NOT NULL ,
[title] nvarchar(1000)  NOT NULL ,
[content] nvarchar(1000)  ,
[authorId] nvarchar(1000)  ,
CONSTRAINT PK_Post_id PRIMARY KEY ([id]))

ALTER TABLE [dbo].[Post] ADD FOREIGN KEY ([authorId]) REFERENCES [dbo].[User]([id]) ON DELETE SET NULL ON UPDATE CASCADE
