import type {
  CollectedTable,
  ColumnDefinition,
  ColumnOptions,
  ColumnType,
  ForeignKeyOptions,
  TableBuilder,
} from './types';

/** Build a `TableBuilder` that records columns/indexes/foreign-keys into `collected`. */
export const createTableBuilder = (collected: CollectedTable): TableBuilder => {
  const push = (name: string, type: ColumnType, options: ColumnOptions = {}): TableBuilder => {
    const def: ColumnDefinition = { name, type, options };
    collected.columns.push(def);
    if (options.index) {
      const idxOpts = options.index === true ? {} : options.index;
      collected.indexes.push({ columns: [name], options: idxOpts });
    }
    return builder;
  };

  const builder: TableBuilder = {
    column: push,
    string: (name, options) => push(name, 'string', options),
    text: (name, options) => push(name, 'text', options),
    integer: (name, options) => push(name, 'integer', options),
    bigint: (name, options) => push(name, 'bigint', options),
    float: (name, options) => push(name, 'float', options),
    decimal: (name, options) => push(name, 'decimal', options),
    boolean: (name, options) => push(name, 'boolean', options),
    date: (name, options) => push(name, 'date', options),
    datetime: (name, options) => push(name, 'datetime', options),
    timestamp: (name, options) => push(name, 'timestamp', options),
    json: (name, options) => push(name, 'json', options),
    binary: (name, options) => push(name, 'binary', options),
    uuid: (name, options) => push(name, 'uuid', options),
    references: (name, options = {}) => {
      const { foreignKey, ...rest } = options as ColumnOptions & { foreignKey?: boolean | ForeignKeyOptions };
      const col = `${name}_id`;
      push(col, 'bigint', rest);
      if (foreignKey) {
        const fkOpts = foreignKey === true ? {} : foreignKey;
        collected.foreignKeys.push({ table: `${name}s`, options: { column: col, ...fkOpts } });
      }
      return builder;
    },
    timestamps: (options = {}) => {
      push('created_at', 'datetime', { null: options.null ?? false });
      push('updated_at', 'datetime', { null: options.null ?? false });
      return builder;
    },
  };
  return builder;
};
