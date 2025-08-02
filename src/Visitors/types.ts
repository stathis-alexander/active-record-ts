import type { Dot } from './Dot';
import type { ToSql } from './ToSql';

type Visitor = Dot | ToSql;

export type { Dot, ToSql, Visitor };
