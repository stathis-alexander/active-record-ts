export class ArelError extends Error {}

export class EmptyJoinError extends ArelError {}
export class BindError extends ArelError {
  constructor(message: string, sql?: string) {
    if (sql) {
      super(`${message} in: ${JSON.stringify(sql)}`);
    } else {
      super(message);
    }
  }
}
