import { Attribute } from './Attribute';
import { Collectors } from './Collectors';
import { DeleteManager } from './DeleteManager';
import { InsertManager } from './InsertManager';
import { Nodes } from './Nodes';
import { SelectManager } from './SelectManager';
import { Table } from './Table';
import { TreeManager } from './TreeManager';
import { UpdateManager } from './UpdateManager';
import { isArelNode } from './utilities/isArelNode';
import { buildQuoted } from './utilities/nodes';
import { Visitors } from './Visitors';

export { ArelError, BindError, EmptyJoinError } from './errors';

const fetchAttribute = (value: string | any, callback: (value: any) => boolean) => {
  if (typeof value !== 'string') {
    return value.fetchAttribute(callback);
  }
};

type SqlOptions = {
  retryable?: boolean;
  positionalBinds?: any[];
  namedBinds?: Record<string, any>;
};

const sql = (sqlString: any, options: SqlOptions = { retryable: false }) => {
  if (sqlString instanceof Nodes.SqlLiteral) return sqlString;

  const { positionalBinds = [], namedBinds = {}, retryable } = options;
  if (
    (positionalBinds == null || positionalBinds.length === 0) &&
    (namedBinds == null || Object.keys(namedBinds).length === 0)
  ) {
    return new Nodes.SqlLiteral(sqlString, { retryable });
  }

  return new Nodes.BoundSqlLiteral(sqlString, positionalBinds, namedBinds);
};

const star = new Nodes.SqlLiteral('*', { retryable: true });

export const Arel = {
  Attribute,
  buildQuoted,
  Collectors,
  DeleteManager,
  fetchAttribute,
  InsertManager,
  isArelNode,
  Nodes,
  sql,
  star,
  SelectManager,
  Table,
  TreeManager,
  UpdateManager,
  Visitors,
};

// const table = new Arel.Table('users');
// const attr = table.attribute('id');
// console.log(table.project(attr.average()).toSql());
// console.log(attr.constructor.name);
