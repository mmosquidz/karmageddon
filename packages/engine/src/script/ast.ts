export type UnaryOperator = "!" | "-";

export type BinaryOperator =
  | "||"
  | "&&"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "+"
  | "-"
  | "*"
  | "/";

export type AssignOperator = "=" | "+=" | "-=" | "*=" | "/=";

export type Expr =
  | { kind: "number"; value: number; position: number }
  | { kind: "string"; value: string; position: number }
  | { kind: "boolean"; value: boolean; position: number }
  | { kind: "name"; name: string; position: number }
  | { kind: "unary"; operator: UnaryOperator; operand: Expr; position: number }
  | { kind: "binary"; operator: BinaryOperator; left: Expr; right: Expr; position: number }
  | { kind: "conditional"; test: Expr; then: Expr; otherwise: Expr; position: number }
  | { kind: "call"; name: string; args: Expr[]; position: number };

export type Statement =
  | { kind: "assign"; target: string; operator: AssignOperator; value: Expr; position: number }
  | { kind: "action"; name: string; args: Expr[]; position: number };
