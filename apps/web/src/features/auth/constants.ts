export const AUTH_INTENT = {
  LOGIN: "LOGIN",
  REGISTER: "REGISTER",
} as const satisfies Record<string, string>;

export type AuthIntent = (typeof AUTH_INTENT)[keyof typeof AUTH_INTENT];
