import { BinaryNode, type LeftType, type RightType } from './Binary';

export class InfixOperationNode<const T extends string> extends BinaryNode {
  public readonly operator: T;

  constructor(operator: T, left: LeftType, right: RightType) {
    super(left, right);
    this.operator = operator;
  }
}

// arithmetic

export class AdditionNode extends InfixOperationNode<'+'> {
  constructor(left: LeftType, right: RightType) {
    super('+', left, right);
  }
}
export class DivisionNode extends InfixOperationNode<'/'> {
  constructor(left: LeftType, right: RightType) {
    super('/', left, right);
  }
}
export class MultiplicationNode extends InfixOperationNode<'*'> {
  constructor(left: LeftType, right: RightType) {
    super('*', left, right);
  }
}
export class SubtractionNode extends InfixOperationNode<'-'> {
  constructor(left: LeftType, right: RightType) {
    super('-', left, right);
  }
}

// comparison operations

export class ConcatenationNode extends InfixOperationNode<'||'> {
  constructor(left: LeftType, right: RightType) {
    super('||', left, right);
  }
}
export class ContainsNode extends InfixOperationNode<'@>'> {
  constructor(left: LeftType, right: RightType) {
    super('@>', left, right);
  }
}
export class OverlapsNode extends InfixOperationNode<'&&'> {
  constructor(left: LeftType, right: RightType) {
    super('&&', left, right);
  }
}

// bitwise operations

export class BitwiseAndNode extends InfixOperationNode<'&'> {
  constructor(left: LeftType, right: RightType) {
    super('&', left, right);
  }
}
export class BitwiseOrNode extends InfixOperationNode<'|'> {
  constructor(left: LeftType, right: RightType) {
    super('|', left, right);
  }
}
export class BitwiseXorNode extends InfixOperationNode<'^'> {
  constructor(left: LeftType, right: RightType) {
    super('^', left, right);
  }
}
export class BitwiseShiftLeftNode extends InfixOperationNode<'<<'> {
  constructor(left: LeftType, right: RightType) {
    super('<<', left, right);
  }
}
export class BitwiseShiftRightNode extends InfixOperationNode<'>>'> {
  constructor(left: LeftType, right: RightType) {
    super('>>', left, right);
  }
}
