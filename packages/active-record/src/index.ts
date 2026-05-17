export { Base, RecordInvalid, RecordNotFound, RecordNotSaved, type BaseConstructor } from './Base';
export { ConnectionAdapter, AdapterUnavailableError, Rollback, resolveLogicalType } from './ConnectionAdapter';
export type { TransactionOptions } from './ConnectionAdapter';
export { Relation } from './Relation';
export type { OrderInput, SelectInput } from './Relation';
export type { WhereInput } from './predicates';
export {
  buildAdapter,
  MySQLAdapter,
  PostgresAdapter,
  PostgresBunAdapter,
  SQLiteAdapter,
} from './adapters';
export type { AdapterName, ColumnInfo, ConnectionConfig, ExecResult, Row } from './types';
export {
  clearConnection,
  connectionContext,
  getConnection,
  getRegistry,
  setConnection,
  setDatabaseConnection,
  setRoleConnection,
  type ConnectionContext,
  type Role,
  type RoleRegistry,
} from './connection';
export {
  defineAssociationAccessor,
  getAssociations,
  lookupAssociation,
  registerAssociation,
  registerPolymorphicClass,
  resolvePolymorphicClass,
  type AssociationKind,
  type AssociationReflection,
  type BelongsToOptions,
  type ClassRef,
  type HasManyOptions,
  type HasOneOptions,
} from './associations';
export { Migration, type MigrationConstructor } from './Migration';
export { Migrator } from './Migrator';
export { SchemaStatements } from './schema/SchemaStatements';
export { createTableBuilder } from './schema/TableBuilder';
export type {
  ColumnDefinition,
  ColumnOptions,
  ColumnType,
  CreateTableOptions,
  ForeignKeyOptions,
  IndexOptions,
  TableBuilder,
} from './schema/types';
