import { Attribute as AttributeClass } from './Attribute';
import { Collectors } from './Collectors';
import { DeleteManager as DeleteManagerClass } from './DeleteManager';
import { InsertManager as InsertManagerClass } from './InsertManager';
import { Nodes } from './Nodes';
import type { BoundSqlLiteralNode } from './Nodes/BoundSqlLiteral';
import type { SqlLiteralNode } from './Nodes/SqlLiteral';
import { SelectManager as SelectManagerClass } from './SelectManager';
import { Table as TableClass } from './Table';
import { TreeManager as TreeManagerClass } from './TreeManager';
import type { BindValue, FetchAttributeCallback, NamedBinds, SqlOptions } from './types';
import { UpdateManager as UpdateManagerClass } from './UpdateManager';
import { isArelNode } from './utilities/isArelNode';
import { buildQuoted } from './utilities/nodes';
import { Visitors } from './Visitors';
import { Dot as DotVisitorClass } from './Visitors/Dot';
import type { MySQL as MySQLVisitorClass } from './Visitors/MySQL';
import type { PostgreSQL as PostgreSQLVisitorClass } from './Visitors/PostgreSQL';
import type { SQLite as SQLiteVisitorClass } from './Visitors/SQLite';
import type { ToSql as ToSqlVisitorClass } from './Visitors/ToSql';

export { ArelError, BindError, EmptyJoinError } from './errors';

/** Carrier for `.fetchAttribute(callback)` — any node that exposes the inspector. */
type FetchAttributeCarrier = { fetchAttribute: (callback: FetchAttributeCallback) => unknown };

const fetchAttribute = (value: string | FetchAttributeCarrier, callback: FetchAttributeCallback): unknown => {
  if (typeof value !== 'string') {
    return value.fetchAttribute(callback);
  }
};

/**
 * Build a SQL literal node. With no extra args returns a `SqlLiteral`; with
 * positional/named binds, returns a `BoundSqlLiteral`.
 */
function sql(sqlString: SqlLiteralNode): SqlLiteralNode;
function sql(sqlString: string): SqlLiteralNode;
function sql(sqlString: string, options: SqlOptions): SqlLiteralNode | BoundSqlLiteralNode;
function sql(sqlString: string, ...binds: BindValue[]): BoundSqlLiteralNode;
function sql(
  sqlString: string | SqlLiteralNode,
  ...rest: [SqlOptions?] | BindValue[]
): SqlLiteralNode | BoundSqlLiteralNode {
  if (sqlString instanceof Nodes.SqlLiteral) return sqlString;

  let positionalBinds: BindValue[] = [];
  let namedBinds: NamedBinds = {};
  let retryable: boolean | undefined = false;

  if (rest.length === 1 && rest[0] && typeof rest[0] === 'object' && !Array.isArray(rest[0])) {
    const options = rest[0] as SqlOptions;
    positionalBinds = options.positionalBinds ?? [];
    namedBinds = options.namedBinds ?? {};
    retryable = options.retryable;
  } else if (rest.length > 0) {
    positionalBinds = rest as BindValue[];
  }

  if (positionalBinds.length === 0 && Object.keys(namedBinds).length === 0) {
    return new Nodes.SqlLiteral(sqlString, { retryable });
  }

  return new Nodes.BoundSqlLiteral(sqlString, positionalBinds, namedBinds);
}

const star = new Nodes.SqlLiteral('*', { retryable: true });

export const Arel = {
  Attribute: AttributeClass,
  buildQuoted,
  Collectors,
  DeleteManager: DeleteManagerClass,
  Dot: DotVisitorClass,
  fetchAttribute,
  InsertManager: InsertManagerClass,
  isArelNode,
  Nodes,
  sql,
  star,
  SelectManager: SelectManagerClass,
  Table: TableClass,
  TreeManager: TreeManagerClass,
  UpdateManager: UpdateManagerClass,
  Visitors,
};

export namespace Arel {
  export type Attribute = AttributeClass;
  export type Table = TableClass;
  export type SelectManager = SelectManagerClass;
  export type InsertManager = InsertManagerClass;
  export type UpdateManager = UpdateManagerClass;
  export type DeleteManager = DeleteManagerClass;
  export type TreeManager = TreeManagerClass;
  export type Dot = DotVisitorClass;

  export namespace Visitors {
    export type ToSql = ToSqlVisitorClass;
    export type MySQL = MySQLVisitorClass;
    export type PostgreSQL = PostgreSQLVisitorClass;
    export type SQLite = SQLiteVisitorClass;
    export type Dot = DotVisitorClass;
  }
}
