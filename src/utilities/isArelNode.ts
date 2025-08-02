import { Attribute } from '../Attribute';
import { Nodes } from '../Nodes';

// biome-ignore lint/suspicious/noExplicitAny: allow anything because we're testing if it's an Arel node
export const isArelNode = (value: any) =>
  value instanceof Nodes.Node || value instanceof Nodes.SqlLiteral || value instanceof Attribute;
