export class ArelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class EmptyJoinError extends ArelError {}
export class BindError extends ArelError {
  constructor(message: string, sql?: string) {
    if (sql) {
      super(`BindError: ${message} in: ${JSON.stringify(sql)}`);
    } else {
      super(`BindError: ${message}`);
    }
  }
}
