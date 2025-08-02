import { Nodes } from './Nodes';
import type { Constructor } from './utilities/mixins';
import { buildQuoted } from './utilities/nodes';

export const MathOperations = <TBase extends Constructor>(Base: TBase) =>
  class MathOperations extends Base {
    add = (other: any) => new Nodes.Addition(this, buildQuoted(other));
    subtract = (other: any) => new Nodes.Subtraction(this, buildQuoted(other));
    multiply = (other: any) => new Nodes.Multiplication(this, buildQuoted(other));
    divide = (other: any) => new Nodes.Division(this, buildQuoted(other));
    bitwiseAnd = (other: any) => new Nodes.BitwiseAnd(this, buildQuoted(other));
    bitwiseOr = (other: any) => new Nodes.BitwiseOr(this, buildQuoted(other));
    bitwiseXor = (other: any) => new Nodes.BitwiseXor(this, buildQuoted(other));
    bitwiseNot = () => new Nodes.BitwiseNot(this);
    bitwiseShiftLeft = (other: any) => new Nodes.BitwiseLeftShift(this, buildQuoted(other));
    bitwiseShiftRight = (other: any) => new Nodes.BitwiseRightShift(this, buildQuoted(other));
  };
