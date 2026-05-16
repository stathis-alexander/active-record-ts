import { AliasPredications } from '../AliasPredication';
import { WindowPredications } from '../WindowPredications';
import { BinaryNode } from './Binary';

export class FilterNode extends WindowPredications(AliasPredications(BinaryNode)) {}
