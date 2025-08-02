import { BinaryNode, type LeftType, type RightType } from './Binary';

type RegexpOptions = {
  caseSensitive?: boolean;
};

export class RegexpNode extends BinaryNode {
  public caseSensitive: boolean;

  constructor(left: LeftType, right: RightType, options: RegexpOptions = { caseSensitive: true }) {
    super(left, right);
    this.caseSensitive = options.caseSensitive ?? true;
  }
}

export class NotRegexpNode extends RegexpNode {}
