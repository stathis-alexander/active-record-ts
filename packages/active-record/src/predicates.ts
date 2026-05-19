/**
 * Build arel predicate trees from the various inputs that `where()` and
 * friends accept on a `Relation`:
 *   - `{ name: 'Alex', age: [21, 22] }` — equality / IN
 *   - `[sql, ...binds]` — bound SQL fragment
 *   - `'sql string'` — raw SQL literal
 *   - any arel `Expression` — used as-is
 */

import { Arel, Nodes as ArelNodes } from '@active-record-ts/arel';
import type { Expression, BindValue } from '@active-record-ts/arel';
import { Base, type BaseConstructor } from './Base';
import { lookupAssociation } from './associations/registry';

export type WhereInput<_T extends Base> =
  | Record<string, unknown>
  | Expression
  | string
  | [string, ...unknown[]];

const collapse = (nodes: Expression[]): Expression => {
  if (nodes.length === 0) return new ArelNodes.True();
  if (nodes.length === 1) return nodes[0]!;
  let current: Expression = nodes[0]!;
  for (let i = 1; i < nodes.length; i++) current = new ArelNodes.And([current, nodes[i]!]);
  return current;
};

export const buildPredicate = <T extends Base>(
  klass: BaseConstructor<T>,
  input: WhereInput<T>,
  negated: boolean,
): Expression => {
  const expr = buildPredicateInner(klass, input);
  return negated ? new ArelNodes.Not(expr) : expr;
};

const buildPredicateInner = <T extends Base>(klass: BaseConstructor<T>, input: WhereInput<T>): Expression => {
  if (typeof input === 'string') {
    return Arel.sql(input);
  }
  if (Array.isArray(input)) {
    const [sql, ...binds] = input as [string, ...BindValue[]];
    return Arel.sql(sql, ...binds);
  }
  if (isExpression(input)) {
    return input as Expression;
  }
  const table = klass.arelTable();
  const conditions: Expression[] = [];
  for (const [name, raw] of Object.entries(input as Record<string, unknown>)) {
    // Sugar: `Post.where({ user: someUser })` resolves to
    // `WHERE user_id = someUser.id` when the association is declared.
    if (raw instanceof Base && Object.prototype.hasOwnProperty.call(klass, Symbol.for('@active-record-ts/active-record:associations'))) {
      // Skip — handled below by the reflection lookup.
    }
    const reflection = isBaseRecord(raw) ? lookupAssociation(klass, name) : null;
    if (reflection && reflection.kind === 'belongs_to') {
      const target = raw as Base;
      const fkValue = target.readAttribute(reflection.primaryKey);
      const fkAttr = table.attribute(reflection.foreignKey);
      conditions.push(
        fkValue == null
          ? fkAttr.equal(null as unknown as Expression)
          : fkAttr.equal(new ArelNodes.BindParam(fkValue as BindValue)),
      );
      continue;
    }
    const attr = table.attribute(name);
    if (raw === null || raw === undefined) {
      conditions.push(attr.equal(null as unknown as Expression));
    } else if (Array.isArray(raw)) {
      const bound = (raw as unknown[]).map((v) => new ArelNodes.BindParam(v as BindValue));
      conditions.push(attr.in(bound as unknown as Expression[]));
    } else if (raw instanceof ArelNodes.Node || isAttributeLike(raw)) {
      conditions.push(attr.equal(raw as Expression));
    } else {
      conditions.push(attr.equal(new ArelNodes.BindParam(raw as BindValue)));
    }
  }
  return collapse(conditions);
}

/** True when `value` is a persisted `Base` record. */
const isBaseRecord = (value: unknown): boolean => {
  return value instanceof Base;
};;

const isExpression = (value: unknown): boolean => {
  if (value == null) return false;
  if (value instanceof ArelNodes.Node) return true;
  if (typeof value === 'object' && 'relation' in value && 'name' in value) return true;
  return false;
};

const isAttributeLike = (value: unknown): boolean => {
  return typeof value === 'object' && value !== null && 'relation' in value && 'name' in value;
};
