import { buildQuoted } from '../utilities/nodes';
import { BinaryNode, type LeftType, type RightType } from './Binary';

export type MatchesNodeOptions = {
  escape?: string;
  caseSensitive?: boolean;
};

export class MatchesNode extends BinaryNode {
  public escape?: string;
  public caseSensitive: boolean;

  constructor(left: LeftType, right: RightType, options: MatchesNodeOptions = {}) {
    super(left, right);
    this.escape = options?.escape ? buildQuoted(options.escape) : undefined;
    this.caseSensitive = options.caseSensitive ?? true;
  }
}

export class DoesNotMatchNode extends MatchesNode {}
