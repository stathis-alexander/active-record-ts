import { Nodes } from './Nodes';
import type { ArelOperand, Expression } from './types';
import type { Constructor } from './utilities/mixins';
import { buildQuoted } from './utilities/nodes';

export const MathOperations = <TBase extends Constructor>(Base: TBase) =>
  class MathOperations extends Base implements ArelOperand {
    declare readonly __arelOperand?: never;
    add = (other: Expression) => new Nodes.Addition(this, buildQuoted(other));
    subtract = (other: Expression) => new Nodes.Subtraction(this, buildQuoted(other));
    multiply = (other: Expression) => new Nodes.Multiplication(this, buildQuoted(other));
    divide = (other: Expression) => new Nodes.Division(this, buildQuoted(other));
    bitwiseAnd = (other: Expression) => new Nodes.BitwiseAnd(this, buildQuoted(other));
    bitwiseOr = (other: Expression) => new Nodes.BitwiseOr(this, buildQuoted(other));
    bitwiseXor = (other: Expression) => new Nodes.BitwiseXor(this, buildQuoted(other));
    bitwiseNot = () => new Nodes.BitwiseNot(this);
    bitwiseShiftLeft = (other: Expression) => new Nodes.BitwiseLeftShift(this, buildQuoted(other));
    bitwiseShiftRight = (other: Expression) => new Nodes.BitwiseRightShift(this, buildQuoted(other));
  };
