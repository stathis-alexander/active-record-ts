import { Attribute } from '../Attribute';
import { Nodes } from '../Nodes';

/** Type guard: does `value` belong to the Arel AST? */
export const isArelNode = (value: unknown): boolean =>
  value instanceof Nodes.Node || value instanceof Nodes.SqlLiteral || value instanceof Attribute;
