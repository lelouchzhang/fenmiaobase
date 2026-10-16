import { z } from "zod";
import { AUTH_INTENT } from "./constants";
import { loginSchema, registerSchema } from "./client.schema";

/**
 * @description 依据字段 intent 的值来决定按哪个 schema 校验, 性能更高
 */
export const authServerSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal(AUTH_INTENT.LOGIN), ...loginSchema.shape }),
  z.object({
    intent: z.literal(AUTH_INTENT.REGISTER),
    ...registerSchema.shape,
  }),
]);
