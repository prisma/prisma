import fs from 'fs'
import path from 'path'
import mssql from 'mssql'

export type SetupParams = {
  connectionString: string
  dirname: string
}

export async function setupMSSQL(options: SetupParams): Promise<void> {
  const { connectionString } = options
  const { dirname } = options

  let schema = `
    IF NOT EXISTS(SELECT * FROM sys.databases WHERE name = 'tests-migrate')
    BEGIN
      CREATE DATABASE [tests-migrate]
    END
    IF NOT EXISTS(SELECT * FROM sys.databases WHERE name = 'tests-migrate-shadowdb')
    BEGIN
      CREATE DATABASE [tests-migrate-shadowdb]
    END

    USE [tests-migrate]
    `
  if (dirname !== '') {
    schema += fs.readFileSync(path.join(dirname, 'setup.sql'), 'utf-8')
  }

  const connectionPool = new mssql.ConnectionPool(connectionString)
  const connection = await connectionPool.connect()

  await connection.query(schema)
  void connection.close()
}

export async function tearDownMSSQL(options: SetupParams) {
  const { connectionString } = options
  const connectionPool = new mssql.ConnectionPool(connectionString)
  const connection = await connectionPool.connect()

  await connection.query(`
  USE "tests-migrate"

  -- Thanks to https://blog.ramondeklein.nl/2016/08/10/clean-up-sql-servers-master-database/
  DECLARE @statement nvarchar(250)

  -- Kill all foreign keys
  DECLARE ForeignKeyCursor CURSOR LOCAL FORWARD_ONLY
  FOR SELECT fk.name, tab.name
      FROM sys.objects fk
      INNER JOIN sys.objects tab ON fk.parent_object_id = tab.object_id
      WHERE fk.TYPE = 'F'
  
  DECLARE @keyName sysname
  DECLARE @tableName sysname
  
  OPEN ForeignKeyCursor
  FETCH NEXT FROM ForeignKeyCursor INTO @keyName, @tableName
  WHILE @@FETCH_STATUS = 0
  BEGIN
      SET @statement = 'ALTER TABLE [' + @tableName + '] DROP CONSTRAINT [' + @keyName + ']'
      EXEC sp_executeSql @statement
  
      FETCH NEXT FROM ForeignKeyCursor INTO @keyName, @tableName
  END
  CLOSE ForeignKeyCursor
  DEALLOCATE ForeignKeyCursor
  
  -- Remove all objects in this database
  DECLARE ObjectCursor CURSOR LOCAL FORWARD_ONLY
  FOR SELECT name, type FROM sys.objects
  DECLARE @name sysname
  DECLARE @type nvarchar(10)
  
  OPEN ObjectCursor
  FETCH NEXT FROM ObjectCursor INTO @name, @type
  WHILE @@FETCH_STATUS = 0
  BEGIN
      SET @statement =
          CASE @type
          WHEN 'FN' THEN 'DROP FUNCTION [' + @name + ']'
          WHEN 'IF' THEN 'DROP FUNCTION [' + @name + ']'
          WHEN 'TF' THEN 'DROP FUNCTION [' + @name + ']'
          WHEN 'P' THEN 'DROP PROCEDURE [' + @name + ']'
          WHEN 'U' THEN 'DROP TABLE [' + @name + ']'
          WHEN 'V' THEN 'DROP VIEW [' + @name + ']'
          ELSE null
      END
  
      IF @statement IS NOT NULL
          EXEC sp_executeSql @statement
  
      FETCH NEXT FROM ObjectCursor INTO @name, @type
  END
  CLOSE ObjectCursor
  DEALLOCATE ObjectCursor
  
  -- Remove all user defined types in this database
  DECLARE UdtCursor CURSOR LOCAL FORWARD_ONLY
  FOR SELECT name FROM sys.Types WHERE is_user_defined = 1
  DECLARE @udtName sysname
  
  OPEN UdtCursor
  FETCH NEXT FROM UdtCursor INTO @udtName
  WHILE @@FETCH_STATUS = 0
  BEGIN
      SET @statement = 'DROP TYPE [' + @udtName + ']'
      EXEC sp_executeSql @statement
  
      FETCH NEXT FROM UdtCursor INTO @udtName
  END
  CLOSE UdtCursor
  DEALLOCATE UdtCursor
`)
  void connection.close()
}
