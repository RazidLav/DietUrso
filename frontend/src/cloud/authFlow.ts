import type { SupabaseClient } from "@supabase/supabase-js";

type Auth = SupabaseClient["auth"];

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function authRedirectUrl(origin: string, recovery = false) {
  return `${origin.replace(/\/$/, "")}/conta?${recovery ? "recovery" : "auth_callback"}=1`;
}

export function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/email not confirmed/i.test(message)) return "Confirme seu e-mail antes de entrar. Você pode reenviar o link abaixo.";
  if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos. Se esqueceu a senha, use a recuperação abaixo.";
  if (/password should be at least|weak password/i.test(message)) return "Use uma senha com pelo menos 6 caracteres.";
  if (/user already registered/i.test(message)) return "Esta conta já existe. Escolha Entrar ou recupere sua senha.";
  if (/email rate limit|rate limit/i.test(message)) return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  if (/e-mail válido|invalid email/i.test(message)) return "Informe um e-mail válido.";
  if (/fetch|network|offline|timeout|failed to send/i.test(message)) return "Sem conexão com o serviço agora. Verifique sua internet e tente novamente.";
  return "Não foi possível concluir agora. Tente novamente; seus dados locais continuam seguros.";
}

export async function signInWithPassword(auth: Pick<Auth, "signInWithPassword">, email: string, password: string) {
  const { data, error } = await auth.signInWithPassword({ email: normalizeEmail(email), password });
  if (error) throw error;
  if (!data.session || !data.user) throw new Error("Sessão não criada. Tente entrar novamente.");
  return data.user;
}

export async function registerWithPassword(auth: Pick<Auth, "signUp">, email: string, password: string, redirectTo?: string) {
  const { data, error } = await auth.signUp({
    email: normalizeEmail(email),
    password,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
  return { needsEmailConfirmation: !data.session, user: data.user };
}

export async function requestPasswordReset(auth: Pick<Auth, "resetPasswordForEmail">, email: string, redirectTo?: string) {
  const { error } = await auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo });
  if (error) throw error;
}

export async function resendEmailConfirmation(auth: Pick<Auth, "resend">, email: string, redirectTo?: string) {
  const { error } = await auth.resend({ type: "signup", email: normalizeEmail(email), options: { emailRedirectTo: redirectTo } });
  if (error) throw error;
}
