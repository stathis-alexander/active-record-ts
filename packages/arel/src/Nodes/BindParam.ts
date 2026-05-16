import type { BindValue } from '../types';
import { hash } from '../utilities/hash';
import { isInfinity, isUnboundable } from '../utilities/nodes';
import { Node } from './Node';

export class BindParamNode extends Node {
  public readonly value: BindValue | undefined;

  constructor(value?: BindValue) {
    super();
    this.value = value;
  }

  override hash = () => hash([this.constructor.name, this.value]);
  override isNull = () => this.value == null;
  valueBeforeTypeCast = (): BindValue | undefined => {
    if (this.value != null && typeof this.value === 'object' && 'valueBeforeTypeCast' in this.value) {
      return (this.value as { valueBeforeTypeCast: () => BindValue }).valueBeforeTypeCast();
    }
    return this.value;
  };
  isInfinity = () => isInfinity(this.value);
  isUnboundable = () => isUnboundable(this.value);
}
