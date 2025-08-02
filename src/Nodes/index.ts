/** biome-ignore-all lint/suspicious/noAssignInExpressions: breaking all the rules in this file to allow lazy loads */
/** biome-ignore-all lint/suspicious/noExplicitAny: allow any use to override typing for lazy loaded attributes */
import type {
  AdditionNode,
  AndNode,
  AscendingNode,
  AsNode,
  AssignmentNode,
  AverageNode,
  BetweenNode,
  BindParamNode,
  BinNode,
  BitwiseAndNode,
  BitwiseNotNode,
  BitwiseOrNode,
  BitwiseShiftLeftNode,
  BitwiseShiftRightNode,
  BitwiseXorNode,
  BoundSqlLiteralNode,
  CaseNode,
  CastedNode,
  CommentNode,
  ConcatenationNode,
  ContainsNode,
  CountNode,
  CteNode,
  CubeNode,
  CurrentRowNode,
  DeleteStatementNode,
  DescendingNode,
  DistinctNode,
  DistinctOnNode,
  DivisionNode,
  DoesNotMatchNode,
  ElseNode,
  EqualityNode,
  ExceptNode,
  ExistsNode,
  ExtractNode,
  FalseNode,
  FilterNode,
  FollowingNode,
  FragmentsNode,
  FullOuterJoinNode,
  GreaterThanNode,
  GreaterThanOrEqualNode,
  GroupingElementNode,
  GroupingNode,
  GroupingSetNode,
  GroupNode,
  HomogeneousInNode,
  InequalityNode,
  InfixOperationNode,
  InNode,
  InnerJoinNode,
  InsertStatementNode,
  IntersectNode,
  IsDistinctFromNode,
  IsNotDistinctFromNode,
  JoinNode,
  JoinSourceNode,
  LateralNode,
  LeadingJoinNode,
  LessThanNode,
  LessThanOrEqualNode,
  LimitNode,
  LockNode,
  MatchesNode,
  MaximumNode,
  MinimumNode,
  MultiplicationNode,
  NamedFunctionNode,
  NamedWindowNode,
  Node,
  NotInNode,
  NotNode,
  NotRegexpNode,
  NullsFirstNode,
  NullsLastNode,
  OffsetNode,
  OnNode,
  OptimizerHintsNode,
  OrNode,
  OuterJoinNode,
  OverlapsNode,
  OverNode,
  PrecedingNode,
  QuotedNode,
  RangeNode,
  RegexpNode,
  RightOuterJoinNode,
  RollUpNode,
  RowsNode,
  SelectCoreNode,
  SelectStatementNode,
  SqlLiteralNode,
  StringJoinNode,
  SubtractionNode,
  SumNode,
  TableAliasNode,
  TrueNode,
  UnaryOperationNode,
  UnionAllNode,
  UnionNode,
  UnqualifiedColumnNode,
  UpdateStatementNode,
  ValuesListNode,
  WhenNode,
  WindowNode,
  WithNode,
  WithRecursiveNode,
} from './types';

// biome-ignore lint/complexity/noStaticOnlyClass: static class allows these attributes to be lazy evaluated Functions
export class Nodes {
  private static _Addition: typeof AdditionNode = null as any;
  private static _And: typeof AndNode = null as any;
  private static _As: typeof AsNode = null as any;
  private static _Ascending: typeof AscendingNode = null as any;
  private static _Assignment: typeof AssignmentNode = null as any;
  private static _Average: typeof AverageNode = null as any;
  private static _Between: typeof BetweenNode = null as any;
  private static _BindParam: typeof BindParamNode = null as any;
  private static _Bin: typeof BinNode = null as any;
  private static _BitwiseAnd: typeof BitwiseAndNode = null as any;
  private static _BitwiseLeftShift: typeof BitwiseShiftLeftNode = null as any;
  private static _BitwiseNot: typeof BitwiseNotNode = null as any;
  private static _BitwiseOr: typeof BitwiseOrNode = null as any;
  private static _BitwiseRightShift: typeof BitwiseShiftRightNode = null as any;
  private static _BitwiseXor: typeof BitwiseXorNode = null as any;
  private static _BoundSqlLiteral: typeof BoundSqlLiteralNode = null as any;
  private static _Case: typeof CaseNode = null as any;
  private static _Casted: typeof CastedNode = null as any;
  private static _Comment: typeof CommentNode = null as any;
  private static _Concatenation: typeof ConcatenationNode = null as any;
  private static _Contains: typeof ContainsNode = null as any;
  private static _Count: typeof CountNode = null as any;
  private static _Cte: typeof CteNode = null as any;
  private static _Cube: typeof CubeNode = null as any;
  private static _CurrentRow: typeof CurrentRowNode = null as any;
  private static _DeleteStatement: typeof DeleteStatementNode = null as any;
  private static _Descending: typeof DescendingNode = null as any;
  private static _Distinct: typeof DistinctNode = null as any;
  private static _DistinctOn: typeof DistinctOnNode = null as any;
  private static _Division: typeof DivisionNode = null as any;
  private static _DoesNotMatch: typeof DoesNotMatchNode = null as any;
  private static _Else: typeof ElseNode = null as any;
  private static _Equality: typeof EqualityNode = null as any;
  private static _Except: typeof ExceptNode = null as any;
  private static _Exists: typeof ExistsNode = null as any;
  private static _Extract: typeof ExtractNode = null as any;
  private static _False: typeof FalseNode = null as any;
  private static _Filter: typeof FilterNode = null as any;
  private static _Following: typeof FollowingNode = null as any;
  private static _Fragments: typeof FragmentsNode = null as any;
  private static _FullOuterJoin: typeof FullOuterJoinNode = null as any;
  private static _GreaterThan: typeof GreaterThanNode = null as any;
  private static _GreaterThanOrEqual: typeof GreaterThanOrEqualNode = null as any;
  private static _GroupingElement: typeof GroupingElementNode = null as any;
  private static _Grouping: typeof GroupingNode = null as any;
  private static _GroupingSet: typeof GroupingSetNode = null as any;
  private static _Group: typeof GroupNode = null as any;
  private static _HomogeneousIn: typeof HomogeneousInNode = null as any;
  private static _Inequality: typeof InequalityNode = null as any;
  private static _InnerJoin: typeof InnerJoinNode = null as any;
  private static _In: typeof InNode = null as any;
  private static _InfixOperation: typeof InfixOperationNode = null as any;
  private static _InsertStatement: typeof InsertStatementNode = null as any;
  private static _Intersect: typeof IntersectNode = null as any;
  private static _IsDistinctFrom: typeof IsDistinctFromNode = null as any;
  private static _IsNotDistinctFrom: typeof IsNotDistinctFromNode = null as any;
  private static _Join: typeof JoinNode = null as any;
  private static _JoinSource: typeof JoinSourceNode = null as any;
  private static _Lateral: typeof LateralNode = null as any;
  private static _LeadingJoin: typeof LeadingJoinNode = null as any;
  private static _LessThan: typeof LessThanNode = null as any;
  private static _LessThanOrEqual: typeof LessThanOrEqualNode = null as any;
  private static _Limit: typeof LimitNode = null as any;
  private static _Lock: typeof LockNode = null as any;
  private static _Matches: typeof MatchesNode = null as any;
  private static _Max: typeof MaximumNode = null as any;
  private static _Min: typeof MinimumNode = null as any;
  private static _Multiplication: typeof MultiplicationNode = null as any;
  private static _NamedFunction: typeof NamedFunctionNode = null as any;
  private static _NamedWindow: typeof NamedWindowNode = null as any;
  private static _Node: typeof Node = null as any;
  private static _NotIn: typeof NotInNode = null as any;
  private static _Not: typeof NotNode = null as any;
  private static _NotRegexp: typeof NotRegexpNode = null as any;
  private static _NullsFirst: typeof NullsFirstNode = null as any;
  private static _NullsLast: typeof NullsLastNode = null as any;
  private static _Offset: typeof OffsetNode = null as any;
  private static _On: typeof OnNode = null as any;
  private static _OptimizerHints: typeof OptimizerHintsNode = null as any;
  private static _Or: typeof OrNode = null as any;
  private static _OuterJoin: typeof OuterJoinNode = null as any;
  private static _Overlaps: typeof OverlapsNode = null as any;
  private static _Over: typeof OverNode = null as any;
  private static _Preceding: typeof PrecedingNode = null as any;
  private static _Quoted: typeof QuotedNode = null as any;
  private static _Range: typeof RangeNode = null as any;
  private static _Regexp: typeof RegexpNode = null as any;
  private static _RightOuterJoin: typeof RightOuterJoinNode = null as any;
  private static _RollUp: typeof RollUpNode = null as any;
  private static _Rows: typeof RowsNode = null as any;
  private static _SelectCore: typeof SelectCoreNode = null as any;
  private static _SelectStatement: typeof SelectStatementNode = null as any;
  private static _SqlLiteral: typeof SqlLiteralNode = null as any;
  private static _StringJoin: typeof StringJoinNode = null as any;
  private static _Subtraction: typeof SubtractionNode = null as any;
  private static _Sum: typeof SumNode = null as any;
  private static _TableAlias: typeof TableAliasNode = null as any;
  private static _True: typeof TrueNode = null as any;
  private static _UnaryOperation: typeof UnaryOperationNode = null as any;
  private static _UnionAll: typeof UnionAllNode = null as any;
  private static _Union: typeof UnionNode = null as any;
  private static _UnqualifiedColumn: typeof UnqualifiedColumnNode = null as any;
  private static _UpdateStatement: typeof UpdateStatementNode = null as any;
  private static _ValuesList: typeof ValuesListNode = null as any;
  private static _When: typeof WhenNode = null as any;
  private static _Window: typeof WindowNode = null as any;
  private static _With: typeof WithNode = null as any;
  private static _WithRecursive: typeof WithRecursiveNode = null as any;

  static get Addition() {
    if (!Nodes._Addition) Nodes._Addition = require('./InfixOperation').AdditionNode;
    return Nodes._Addition;
  }

  static get And() {
    if (!Nodes._And) Nodes._And = require('./Nary').AndNode;
    return Nodes._And;
  }

  static get As() {
    if (!Nodes._As) Nodes._As = require('./Binary').AsNode;
    return Nodes._As;
  }

  static get Ascending() {
    if (!Nodes._Ascending) Nodes._Ascending = require('./Ascending').AscendingNode;
    return Nodes._Ascending;
  }

  static get Assignment() {
    if (!Nodes._Assignment) Nodes._Assignment = require('./Binary').AssignmentNode;
    return Nodes._Assignment;
  }

  static get Average() {
    if (!Nodes._Average) Nodes._Average = require('./Function').AverageNode;
    return Nodes._Average;
  }

  static get Between() {
    if (!Nodes._Between) Nodes._Between = require('./Binary').BetweenNode;
    return Nodes._Between;
  }

  static get BindParam() {
    if (!Nodes._BindParam) Nodes._BindParam = require('./BindParam').BindParamNode;
    return Nodes._BindParam;
  }

  static get Bin() {
    if (!Nodes._Bin) Nodes._Bin = require('./Unary').BinNode;
    return Nodes._Bin;
  }

  static get BitwiseAnd() {
    if (!Nodes._BitwiseAnd) Nodes._BitwiseAnd = require('./InfixOperation').BitwiseAndNode;
    return Nodes._BitwiseAnd;
  }

  static get BitwiseLeftShift() {
    if (!Nodes._BitwiseLeftShift) Nodes._BitwiseLeftShift = require('./InfixOperation').BitwiseShiftLeftNode;
    return Nodes._BitwiseLeftShift;
  }

  static get BitwiseNot() {
    if (!Nodes._BitwiseNot) Nodes._BitwiseNot = require('./UnaryOperation').BitwiseNotNode;
    return Nodes._BitwiseNot;
  }

  static get BitwiseOr() {
    if (!Nodes._BitwiseOr) Nodes._BitwiseOr = require('./InfixOperation').BitwiseOrNode;
    return Nodes._BitwiseOr;
  }

  static get BitwiseRightShift() {
    if (!Nodes._BitwiseRightShift) Nodes._BitwiseRightShift = require('./InfixOperation').BitwiseShiftRightNode;
    return Nodes._BitwiseRightShift;
  }

  static get BitwiseXor() {
    if (!Nodes._BitwiseXor) Nodes._BitwiseXor = require('./InfixOperation').BitwiseXorNode;
    return Nodes._BitwiseXor;
  }

  static get BoundSqlLiteral() {
    if (!Nodes._BoundSqlLiteral) Nodes._BoundSqlLiteral = require('./BoundSqlLiteral').BoundSqlLiteralNode;
    return Nodes._BoundSqlLiteral;
  }

  static get Case() {
    if (!Nodes._Case) Nodes._Case = require('./Case').CaseNode;
    return Nodes._Case;
  }

  static get Casted() {
    if (!Nodes._Casted) Nodes._Casted = require('./Casted').CastedNode;
    return Nodes._Casted;
  }

  static get Comment() {
    if (!Nodes._Comment) Nodes._Comment = require('./Comment').CommentNode;
    return Nodes._Comment;
  }

  static get Concatenation() {
    if (!Nodes._Concatenation) Nodes._Concatenation = require('./InfixOperation').ConcatenationNode;
    return Nodes._Concatenation;
  }

  static get Contains() {
    if (!Nodes._Contains) Nodes._Contains = require('./InfixOperation').ContainsNode;
    return Nodes._Contains;
  }

  static get Count() {
    if (!Nodes._Count) Nodes._Count = require('./Count').CountNode;
    return Nodes._Count;
  }

  static get Cte() {
    if (!Nodes._Cte) Nodes._Cte = require('./Cte').CteNode;
    return Nodes._Cte;
  }

  static get Cube() {
    if (!Nodes._Cube) Nodes._Cube = require('./Unary').CubeNode;
    return Nodes._Cube;
  }

  static get CurrentRow() {
    if (!Nodes._CurrentRow) Nodes._CurrentRow = require('./Window').CurrentRowNode;
    return Nodes._CurrentRow;
  }

  static get DeleteStatement() {
    if (!Nodes._DeleteStatement) Nodes._DeleteStatement = require('./DeleteStatement').DeleteStatementNode;
    return Nodes._DeleteStatement;
  }

  static get Descending() {
    if (!Nodes._Descending) Nodes._Descending = require('./Descending').DescendingNode;
    return Nodes._Descending;
  }

  static get Distinct() {
    if (!Nodes._Distinct) Nodes._Distinct = require('./Terminal').DistinctNode;
    return Nodes._Distinct;
  }

  static get DistinctOn() {
    if (!Nodes._DistinctOn) Nodes._DistinctOn = require('./Unary').DistinctOnNode;
    return Nodes._DistinctOn;
  }

  static get Division() {
    if (!Nodes._Division) Nodes._Division = require('./InfixOperation').DivisionNode;
    return Nodes._Division;
  }

  static get DoesNotMatch() {
    if (!Nodes._DoesNotMatch) Nodes._DoesNotMatch = require('./Matches').DoesNotMatchNode;
    return Nodes._DoesNotMatch;
  }

  static get Else() {
    if (!Nodes._Else) Nodes._Else = require('./Case').ElseNode;
    return Nodes._Else;
  }

  static get Equality() {
    if (!Nodes._Equality) Nodes._Equality = require('./Equality').EqualityNode;
    return Nodes._Equality;
  }

  static get Except() {
    if (!Nodes._Except) Nodes._Except = require('./Binary').ExceptNode;
    return Nodes._Except;
  }

  static get Exists() {
    if (!Nodes._Exists) Nodes._Exists = require('./Function').ExistsNode;
    return Nodes._Exists;
  }

  static get Extract() {
    if (!Nodes._Extract) Nodes._Extract = require('./Extract').ExtractNode;
    return Nodes._Extract;
  }

  static get False() {
    if (!Nodes._False) Nodes._False = require('./False').FalseNode;
    return Nodes._False;
  }

  static get Filter() {
    if (!Nodes._Filter) Nodes._Filter = require('./Filter').FilterNode;
    return Nodes._Filter;
  }

  static get Following() {
    if (!Nodes._Following) Nodes._Following = require('./Window').FollowingNode;
    return Nodes._Following;
  }

  static get Fragments() {
    if (!Nodes._Fragments) Nodes._Fragments = require('./Fragments').FragmentsNode;
    return Nodes._Fragments;
  }

  static get FullOuterJoin() {
    if (!Nodes._FullOuterJoin) Nodes._FullOuterJoin = require('./FullOuterJoin').FullOuterJoinNode;
    return Nodes._FullOuterJoin;
  }

  static get GreaterThan() {
    if (!Nodes._GreaterThan) Nodes._GreaterThan = require('./Binary').GreaterThanNode;
    return Nodes._GreaterThan;
  }

  static get GreaterThanOrEqual() {
    if (!Nodes._GreaterThanOrEqual) Nodes._GreaterThanOrEqual = require('./Binary').GreaterThanOrEqualNode;
    return Nodes._GreaterThanOrEqual;
  }

  static get GroupingElement() {
    if (!Nodes._GroupingElement) Nodes._GroupingElement = require('./Unary').GroupingElementNode;
    return Nodes._GroupingElement;
  }

  static get Grouping() {
    if (!Nodes._Grouping) Nodes._Grouping = require('./Grouping').GroupingNode;
    return Nodes._Grouping;
  }

  static get GroupingSet() {
    if (!Nodes._GroupingSet) Nodes._GroupingSet = require('./Unary').GroupingSetNode;
    return Nodes._GroupingSet;
  }

  static get Group() {
    if (!Nodes._Group) Nodes._Group = require('./Unary').GroupNode;
    return Nodes._Group;
  }

  static get HomogeneousIn() {
    if (!Nodes._HomogeneousIn) Nodes._HomogeneousIn = require('./HomogeneousIn').HomogeneousInNode;
    return Nodes._HomogeneousIn;
  }

  static get Inequality() {
    if (!Nodes._Inequality) Nodes._Inequality = require('./Binary').InequalityNode;
    return Nodes._Inequality;
  }

  static get InnerJoin() {
    if (!Nodes._InnerJoin) Nodes._InnerJoin = require('./InnerJoin').InnerJoinNode;
    return Nodes._InnerJoin;
  }

  static get In() {
    if (!Nodes._In) Nodes._In = require('./In').InNode;
    return Nodes._In;
  }

  static get InfixOperation() {
    if (!Nodes._InfixOperation) Nodes._InfixOperation = require('./InfixOperation').InfixOperationNode;
    return Nodes._InfixOperation;
  }

  static get InsertStatement() {
    if (!Nodes._InsertStatement) Nodes._InsertStatement = require('./InsertStatement').InsertStatementNode;
    return Nodes._InsertStatement;
  }

  static get Intersect() {
    if (!Nodes._Intersect) Nodes._Intersect = require('./Binary').IntersectNode;
    return Nodes._Intersect;
  }

  static get IsDistinctFrom() {
    if (!Nodes._IsDistinctFrom) Nodes._IsDistinctFrom = require('./Binary').IsDistinctFromNode;
    return Nodes._IsDistinctFrom;
  }

  static get IsNotDistinctFrom() {
    if (!Nodes._IsNotDistinctFrom) Nodes._IsNotDistinctFrom = require('./Binary').IsNotDistinctFromNode;
    return Nodes._IsNotDistinctFrom;
  }

  static get Join() {
    if (!Nodes._Join) Nodes._Join = require('./Binary').JoinNode;
    return Nodes._Join;
  }

  static get JoinSource() {
    if (!Nodes._JoinSource) Nodes._JoinSource = require('./JoinSource').JoinSourceNode;
    return Nodes._JoinSource;
  }

  static get Lateral() {
    if (!Nodes._Lateral) Nodes._Lateral = require('./Unary').LateralNode;
    return Nodes._Lateral;
  }

  static get LeadingJoin() {
    if (!Nodes._LeadingJoin) Nodes._LeadingJoin = require('./LeadingJoin').LeadingJoinNode;
    return Nodes._LeadingJoin;
  }

  static get LessThan() {
    if (!Nodes._LessThan) Nodes._LessThan = require('./Binary').LessThanNode;
    return Nodes._LessThan;
  }

  static get LessThanOrEqual() {
    if (!Nodes._LessThanOrEqual) Nodes._LessThanOrEqual = require('./Binary').LessThanOrEqualNode;
    return Nodes._LessThanOrEqual;
  }

  static get Limit() {
    if (!Nodes._Limit) Nodes._Limit = require('./Unary').LimitNode;
    return Nodes._Limit;
  }

  static get Lock() {
    if (!Nodes._Lock) Nodes._Lock = require('./Unary').LockNode;
    return Nodes._Lock;
  }

  static get Matches() {
    if (!Nodes._Matches) Nodes._Matches = require('./Matches').MatchesNode;
    return Nodes._Matches;
  }

  static get Max() {
    if (!Nodes._Max) Nodes._Max = require('./Function').MaximumNode;
    return Nodes._Max;
  }

  static get Min() {
    if (!Nodes._Min) Nodes._Min = require('./Function').MinimumNode;
    return Nodes._Min;
  }

  static get Multiplication() {
    if (!Nodes._Multiplication) Nodes._Multiplication = require('./InfixOperation').MultiplicationNode;
    return Nodes._Multiplication;
  }

  static get NamedFunction() {
    if (!Nodes._NamedFunction) Nodes._NamedFunction = require('./NamedFunction').NamedFunctionNode;
    return Nodes._NamedFunction;
  }

  static get NamedWindow() {
    if (!Nodes._NamedWindow) Nodes._NamedWindow = require('./Window').NamedWindowNode;
    return Nodes._NamedWindow;
  }

  static get Node() {
    if (!Nodes._Node) Nodes._Node = require('./Node').Node;
    return Nodes._Node;
  }

  static get NotIn() {
    if (!Nodes._NotIn) Nodes._NotIn = require('./Binary').NotInNode;
    return Nodes._NotIn;
  }

  static get Not() {
    if (!Nodes._Not) Nodes._Not = require('./Unary').NotNode;
    return Nodes._Not;
  }

  static get NotRegexp() {
    if (!Nodes._NotRegexp) Nodes._NotRegexp = require('./Regexp').NotRegexpNode;
    return Nodes._NotRegexp;
  }

  static get NullsFirst() {
    if (!Nodes._NullsFirst) Nodes._NullsFirst = require('./Ordering').NullsFirstNode;
    return Nodes._NullsFirst;
  }

  static get NullsLast() {
    if (!Nodes._NullsLast) Nodes._NullsLast = require('./Ordering').NullsLastNode;
    return Nodes._NullsLast;
  }

  static get Offset() {
    if (!Nodes._Offset) Nodes._Offset = require('./Unary').OffsetNode;
    return Nodes._Offset;
  }

  static get On() {
    if (!Nodes._On) Nodes._On = require('./Unary').OnNode;
    return Nodes._On;
  }

  static get OptimizerHints() {
    if (!Nodes._OptimizerHints) Nodes._OptimizerHints = require('./Unary').OptimizerHintsNode;
    return Nodes._OptimizerHints;
  }

  static get Or() {
    if (!Nodes._Or) Nodes._Or = require('./Nary').OrNode;
    return Nodes._Or;
  }

  static get OuterJoin() {
    if (!Nodes._OuterJoin) Nodes._OuterJoin = require('./OuterJoin').OuterJoinNode;
    return Nodes._OuterJoin;
  }

  static get Overlaps() {
    if (!Nodes._Overlaps) Nodes._Overlaps = require('./InfixOperation').OverlapsNode;
    return Nodes._Overlaps;
  }

  static get Over() {
    if (!Nodes._Over) Nodes._Over = require('./Over').OverNode;
    return Nodes._Over;
  }

  static get Preceding() {
    if (!Nodes._Preceding) Nodes._Preceding = require('./Window').PrecedingNode;
    return Nodes._Preceding;
  }

  static get Quoted() {
    if (!Nodes._Quoted) Nodes._Quoted = require('./Casted').QuotedNode;
    return Nodes._Quoted;
  }

  static get Range() {
    if (!Nodes._Range) Nodes._Range = require('./Window').RangeNode;
    return Nodes._Range;
  }

  static get Regexp() {
    if (!Nodes._Regexp) Nodes._Regexp = require('./Regexp').RegexpNode;
    return Nodes._Regexp;
  }

  static get RightOuterJoin() {
    if (!Nodes._RightOuterJoin) Nodes._RightOuterJoin = require('./RightOuterJoin').RightOuterJoinNode;
    return Nodes._RightOuterJoin;
  }

  static get RollUp() {
    if (!Nodes._RollUp) Nodes._RollUp = require('./Unary').RollUpNode;
    return Nodes._RollUp;
  }

  static get Rows() {
    if (!Nodes._Rows) Nodes._Rows = require('./Window').RowsNode;
    return Nodes._Rows;
  }

  static get SelectCore() {
    if (!Nodes._SelectCore) Nodes._SelectCore = require('./SelectCore').SelectCoreNode;
    return Nodes._SelectCore;
  }

  static get SelectStatement() {
    if (!Nodes._SelectStatement) Nodes._SelectStatement = require('./SelectStatement').SelectStatementNode;
    return Nodes._SelectStatement;
  }

  static get SqlLiteral() {
    if (!Nodes._SqlLiteral) Nodes._SqlLiteral = require('./SqlLiteral').SqlLiteralNode;
    return Nodes._SqlLiteral;
  }

  static get StringJoin() {
    if (!Nodes._StringJoin) Nodes._StringJoin = require('./StringJoin').StringJoinNode;
    return Nodes._StringJoin;
  }

  static get Subtraction() {
    if (!Nodes._Subtraction) Nodes._Subtraction = require('./InfixOperation').SubtractionNode;
    return Nodes._Subtraction;
  }

  static get Sum() {
    if (!Nodes._Sum) Nodes._Sum = require('./Function').SumNode;
    return Nodes._Sum;
  }

  static get TableAlias() {
    if (!Nodes._TableAlias) Nodes._TableAlias = require('./TableAlias').TableAliasNode;
    return Nodes._TableAlias;
  }

  static get True() {
    if (!Nodes._True) Nodes._True = require('./True').TrueNode;
    return Nodes._True;
  }

  static get UnaryOperation() {
    if (!Nodes._UnaryOperation) Nodes._UnaryOperation = require('./UnaryOperation').UnaryOperationNode;
    return Nodes._UnaryOperation;
  }

  static get UnionAll() {
    if (!Nodes._UnionAll) Nodes._UnionAll = require('./Binary').UnionAllNode;
    return Nodes._UnionAll;
  }

  static get Union() {
    if (!Nodes._Union) Nodes._Union = require('./Binary').UnionNode;
    return Nodes._Union;
  }

  static get UnqualifiedColumn() {
    if (!Nodes._UnqualifiedColumn) Nodes._UnqualifiedColumn = require('./UnqualifiedColumn').UnqualifiedColumnNode;
    return Nodes._UnqualifiedColumn;
  }

  static get UpdateStatement() {
    if (!Nodes._UpdateStatement) Nodes._UpdateStatement = require('./UpdateStatement').UpdateStatementNode;
    return Nodes._UpdateStatement;
  }

  static get ValuesList() {
    if (!Nodes._ValuesList) Nodes._ValuesList = require('./ValuesList').ValuesListNode;
    return Nodes._ValuesList;
  }

  static get When() {
    if (!Nodes._When) Nodes._When = require('./Case').WhenNode;
    return Nodes._When;
  }

  static get Window() {
    if (!Nodes._Window) Nodes._Window = require('./Window').WindowNode;
    return Nodes._Window;
  }

  static get With() {
    if (!Nodes._With) Nodes._With = require('./With').WithNode;
    return Nodes._With;
  }

  static get WithRecursive() {
    if (!Nodes._WithRecursive) Nodes._WithRecursive = require('./With').WithRecursiveNode;
    return Nodes._WithRecursive;
  }
}
