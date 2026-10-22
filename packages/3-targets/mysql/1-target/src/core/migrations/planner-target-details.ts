/** What a MySQL migration operation addresses. MySQL has no schema inside a database, so `schema` names the connection's database. */
export interface MysqlPlanTargetDetails {
  readonly schema: string;
  readonly objectType: 'table' | 'column' | 'primaryKey' | 'unique' | 'index' | 'foreignKey';
  readonly name: string;
  readonly table?: string;
}
