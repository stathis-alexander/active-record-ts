import type { Expression } from '../types';
import { buildQuoted } from '../utilities/nodes';
import { BinaryNode } from './Binary';

export type MatchesNodeOptions = {
  escape?: string | null;
  caseSensitive?: boolean;
};

export class MatchesNode extends BinaryNode {
  /** Stored as the quoted form (`Quoted` node) so the visitor can emit it directly. */
  public escape?: Expression;
  public caseSensitive: boolean;

  constructor(left: Expression, right: Expression, options: MatchesNodeOptions = {}) {
    super(left, right);
    this.escape = options?.escape ? buildQuoted(options.escape) : undefined;
    this.caseSensitive = options.caseSensitive ?? false;
  }
}

export class DoesNotMatchNode extends MatchesNode {}
