import { AliasPredications } from '../AliasPredication';
import { BinaryNode } from './Binary';

export class OverNode extends AliasPredications(BinaryNode) {
  public readonly operator = 'OVER';
}
