import { AliasPredications } from './AliasPredication';
import { Expressions } from './Expressions';
import { MathOperations } from './Math';
import { OrderPredications } from './OrderPredications';
import { Predications } from './Predications';

type RelationType = any;
type NameType = any;

export class Attribute extends MathOperations(OrderPredications(Predications(Expressions(AliasPredications(Object))))) {
  public relation: RelationType;
  public name: NameType;

  constructor(relation: RelationType, name: NameType) {
    super();
    this.relation = relation;
    this.name = name;
  }

  lower = () => this.relation.lower(this);
  typeCaster = () => this.relation.typeForAttribute(this.name);
  typeCastForDatabase = (value: any) => this.relation.typeCastForDatabase(this.name, value);
  ableToTypeCast = () => this.relation.ableToTypeCast();
}
