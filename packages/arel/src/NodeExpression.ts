import { AliasPredications } from './AliasPredication';
import { Expressions } from './Expressions';
import { MathOperations } from './Math';
import { Node } from './Nodes/Node';
import { OrderPredications } from './OrderPredications';
import { Predications } from './Predications';

// This class mixes in a number of other classes:
// 1. alias predications
// 2. expressions
// 3. predications
// 4. order predications
// 5. math operations

export class NodeExpression extends MathOperations(
  OrderPredications(Predications(Expressions(AliasPredications(Node)))),
) {}
