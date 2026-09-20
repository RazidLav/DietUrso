import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { authErrorMessage, authRedirectUrl, normalizeEmail, registerWithPassword, requestPasswordReset, resendEmailConfirmation, signInWithPassword } from "../src/cloud/authFlow";
import { resolvePlanView } from "../src/cloud/planViewState";
import { beginSession, clonePrescription, copyTrainingPlanDayState, createDefaultPrescription, createInitialTrainingState, materializePlans, trainingPlanEndDate, upsertTrainingPlanState } from "../src/training/calculations";
import type { TrainingPlan, TrainingPlanItem } from "../src/training/types";

test("UrsoFit é a marca pública na navegação, autenticação e metadados", () => {
  const paths = ["app/conta.tsx", "app/boas-vindas.tsx", "src/components/AppNavigation.tsx", "public/manifest.json", "public/index.html", "app/+html.tsx"];
  for (const path of paths) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /UrsoFit|URSOFIT/);
    assert.doesNotMatch(source, /DietUrso|DIETURSO/);
  }
});

test("login normaliza e-mail e aceita uma sessão válida sem depender do banco de dados", async () => {
  let received = "";
  const user = { id: "user-1", email: "exemplo@site.com" };
  const auth = { signInWithPassword: async ({ email }: { email: string; password: string }) => { received = email; return { data: { user, session: { user } }, error: null }; } };
  assert.equal((await signInWithPassword(auth as never, "  Exemplo@Site.com  ", "segredo")).id, "user-1");
  assert.equal(received, "exemplo@site.com");
  assert.equal(normalizeEmail("  EU@SITE.COM "), "eu@site.com");
});

test("cadastro pendente não anuncia sessão criada", async () => {
  const auth = { signUp: async () => ({ data: { user: { id: "user-2" }, session: null }, error: null }) };
  const result = await registerWithPassword(auth as never, "  TESTE@SITE.COM ", "senha123", authRedirectUrl("https://dieturso.onrender.com"));
  assert.equal(result.needsEmailConfirmation, true);
  assert.equal(authRedirectUrl("https://dieturso.onrender.com/"), "https://dieturso.onrender.com/conta?auth_callback=1");
});

test("credenciais inválidas e e-mail não confirmado recebem mensagens distintas", () => {
  assert.match(authErrorMessage(new Error("Invalid login credentials")), /senha incorretos/);
  assert.match(authErrorMessage(new Error("Email not confirmed")), /Confirme seu e-mail/);
  assert.match(authErrorMessage(new Error("Failed to fetch")), /conexão/);
});

test("reenvio e recuperação usam e-mail normalizado e redirecionamento seguro", async () => {
  let resetEmail = ""; let resendEmail = "";
  await requestPasswordReset({ resetPasswordForEmail: async (email: string) => { resetEmail = email; return { data: {}, error: null }; } } as never, " EU@SITE.COM ", authRedirectUrl("https://dieturso.onrender.com", true));
  await resendEmailConfirmation({ resend: async ({ email }: { email: string }) => { resendEmail = email; return { data: {}, error: null }; } } as never, " EU@SITE.COM ");
  assert.equal(resetEmail, "eu@site.com");
  assert.equal(resendEmail, "eu@site.com");
  assert.equal(authRedirectUrl("https://dieturso.onrender.com", true), "https://dieturso.onrender.com/conta?recovery=1");
});

test("plano não aparece como vazio durante sessão ou consulta pendente", () => {
  assert.equal(resolvePlanView(false, "empty", false), "loading");
  assert.equal(resolvePlanView(true, "idle", false), "loading");
  assert.equal(resolvePlanView(true, "loading", false), "loading");
  assert.equal(resolvePlanView(true, "error", false), "error");
  assert.equal(resolvePlanView(true, "success", true), "data");
  assert.equal(resolvePlanView(true, "empty", false), "empty");
  assert.equal(resolvePlanView(true, "error", true), "data");
  assert.equal(resolvePlanView(true, "empty", false, true), "error");
});

function weeklyPlan(id: string, item: TrainingPlanItem): TrainingPlan {
  return { id, name: id, repeatWeekly: true, days: Array.from({ length: 7 }, (_, weekday) => ({ weekday, items: weekday === 1 ? [item] : [] })), createdAt: "2026-09-20T12:00:00Z", updatedAt: "2026-09-20T12:00:00Z" };
}

test("um dia aceita cópias e várias modalidades sem compartilhar status", () => {
  const strength = { id: "strength", name: "Força", activityType: "strength" as const, prescription: createDefaultPrescription("strength"), order: 0 };
  const running = { id: "running", name: "Corrida", activityType: "running" as const, prescription: createDefaultPrescription("running"), order: 1 };
  let state = upsertTrainingPlanState(createInitialTrainingState(), weeklyPlan("p1", strength));
  state.plans[0].days[1].items.push(running);
  state = copyTrainingPlanDayState(state, "p1", 1, 1);
  assert.equal(state.plans[0].days[1].items.length, 4);
  assert.equal(new Set(state.plans[0].days[1].items.map((item) => item.id)).size, 4);
  state = materializePlans(state, "2026-09-21", "2026-09-21");
  const first = beginSession(state, state.plannedSessions[0].id);
  assert.equal(first.state.plannedSessions.length, 4);
  assert.equal(first.state.sessions.length, 1);
});

test("plano ativo antigo ou arquivado não apaga a programação de outro plano", () => {
  const item = { id: "i1", name: "Corrida", activityType: "running" as const, prescription: createDefaultPrescription("running"), order: 0 };
  const state = upsertTrainingPlanState(createInitialTrainingState(), weeklyPlan("novo", item));
  state.activePlanId = "id-antigo";
  assert.equal(materializePlans(state, "2026-09-21", "2026-09-21").plannedSessions.length, 1);
});

test("rascunho não é programado; histórico preserva prescrição e três níveis de notas", () => {
  const strength = createDefaultPrescription("strength");
  strength.strength!.exercises.push({ id: "e1", exerciseSnapshot: { id: "e1", name: "Agachamento", laterality: "bilateral", instructions: "Controlar a descida" }, order: 0, planNotes: "RIR 2 nesta semana", sets: [{ id: "s1", kind: "working", plannedReps: 12, loadUnit: "kg", technique: "drop_set", toFailure: false, notes: "Reduzir carga após 12" }] });
  const item = { id: "i1", name: "Quadríceps", activityType: "strength" as const, prescription: strength, notes: "Treino da segunda", isDraft: true, order: 0 };
  let state = upsertTrainingPlanState(createInitialTrainingState(), weeklyPlan("p1", item));
  assert.equal(materializePlans(state, "2026-09-21", "2026-09-21").plannedSessions.length, 0);
  state.plans[0].days[1].items[0].isDraft = false;
  state = materializePlans(state, "2026-09-21", "2026-09-21");
  const execution = beginSession(state, state.plannedSessions[0].id).session;
  state.plans[0].days[1].items[0].prescription.strength!.exercises[0].planNotes = "Plano alterado";
  assert.equal(execution.prescriptionSnapshot.strength!.exercises[0].exerciseSnapshot.instructions, "Controlar a descida");
  assert.equal(execution.prescriptionSnapshot.strength!.exercises[0].planNotes, "RIR 2 nesta semana");
  assert.equal(execution.result.strengthSets[0].notes, undefined);
  assert.equal(clonePrescription(execution.prescriptionSnapshot).strength!.exercises[0].sets[0].technique, "drop_set");
});

test("período finito produz data final estável", () => {
  assert.equal(trainingPlanEndDate("2026-09-21", 2), "2026-10-04");
  assert.throws(() => trainingPlanEndDate("", 2));
  assert.throws(() => trainingPlanEndDate("2026-02-31", 2));
});
