import { z } from "zod";
import type { LoginInput, RegisterInput } from "@fmbase/types";

export const loginSchema = z.object({
  email: z.email("Invalid email."),
  password: z.string().min(1, "Password is Required."),
}) satisfies z.ZodType<LoginInput>;

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required."),
  email: z.email("Invalid email."),
  password: z.string().min(8, "Password must be at least 8 Characters."),
}) satisfies z.ZodType<RegisterInput>;
