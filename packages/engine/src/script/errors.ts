/** A script that cannot be read, checked or run. `position` is a 0-based offset in the script. */
export class ScriptError extends Error {
  readonly position: number;

  constructor(message: string, position: number) {
    super(message);
    this.name = "ScriptError";
    this.position = position;
  }
}

export function describeScriptError(error: ScriptError): string {
  return `${error.message} (colonne ${error.position + 1})`;
}
