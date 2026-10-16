"use server";

import { redirect } from "next/navigation";
import { AUTH_INTENT } from "./constants";
import { authServerSchema } from "./server.schema";
import { z } from "zod";
import { applyAuthCookiesFromResponse } from "./cookies";

/**
 * 认证表单 action 的返回状态。
 *
 * 这里的错误信息被分成两类，分别对应不同的展示场景：
 *
 * - error：表单级错误。用于展示与整个表单相关的错误信息，
 *   例如：登录失败、验证码错误、账号被锁定、服务器异常。
 *   这类错误通常显示在表单顶部或全局提示区域。
 *
 * - fieldErrors：字段级错误。用于展示某个输入项不符合校验规则的
 *   错误，例如：邮箱为空、密码格式错误、确认密码不一致。
 *   这类错误通常显示在对应输入框下方。
 *
 * 在实际使用中，通常会在 Zod 校验失败时，把校验结果转换成这两类信息：
 * - formErrors -> error
 * - fieldErrors -> fieldErrors
 *
 * 这样前端可以在不同位置展示更准确的错误提示，提升表单体验。
 */
export type AuthActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function authAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const raw = Object.fromEntries(formData);
  const parsed = authServerSchema.safeParse(raw);

  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);

    return {
      error: flat.formErrors[0],
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    };
  }

  const { intent, ...data } = parsed.data;

  let res: Response;

  switch (intent) {
    case AUTH_INTENT.LOGIN: {
      res = await fetch(`${process.env.API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        return { error: body.message ?? "Login failed." };
      }
      break;
    }
    case AUTH_INTENT.REGISTER: {
      res = await fetch(`${process.env.API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        return { error: body.message ?? "Registration failed" };
      }

      break;
    }
    default: {
      const _exhaustiveCheck: never = intent;
      return _exhaustiveCheck;
    }
  }
  await applyAuthCookiesFromResponse(res!);
  redirect("/dashboard");
}
