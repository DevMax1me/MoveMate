#!/usr/bin/env node
// Données de démonstration FICTIVES via l'API d'un serveur lancé (npm run dev / npm start).
// Usage : BASE_URL=http://localhost:3000 node scripts/seed-demo.mjs
const BASE = process.env.BASE_URL || "http://localhost:3000";
const EMAIL = process.env.DEMO_EMAIL || "demo@terminator.local", PW = process.env.DEMO_PASSWORD || "demo-motdepasse-123";
let cookie = "";
async function call(method, path, body) {
  const res = await fetch(BASE + "/api" + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${json.error ?? ""}`);
  return json;
}
const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

let r = await call("POST", "/auth/register", { email: EMAIL, password: PW, adult: true, name: "Démo", tz: "Europe/Paris" }).catch(async (e) => { if (!String(e).includes("409")) throw e; return call("POST", "/auth/login", { email: EMAIL, password: PW }); });
await call("POST", "/lifestyle", { data: { goal: "habitudes plus régulières", level: "débutant", equipment: ["haltères", "banc"], sessions_per_week: 3, max_session_min: 40, budget: "moyen", cook_time_max_min: 25, people: 2, excluded_foods: [], coaching: { style: "factuel" } } });
await call("POST", "/goals", { phase: "maintien", start_date: day(30), kcal: 2200, protein: 120, carbs: 250, fat: 70 });
const foods = (await call("GET", "/foods?q=")).foods;
const f = (n) => foods.find((x) => x.name.startsWith(n));
for (let i = 1; i <= 10; i++) await call("POST", "/weights", { date: day(i), kg: 78 - i * 0.1 + (i % 3) * 0.2 });
for (let i = 1; i <= 6; i++) {
  for (const [cat, name, qty, unit] of [["Petit-déjeuner", "Flocons", 50, "g"], ["Déjeuner", "Riz blanc", 150, "g"], ["Déjeuner", "Poulet", 120, "g"], ["Dîner", "Pâtes", 180, "g"], ["Dîner", "Brocoli", 150, "g"]])
    await call("POST", "/meals", { date: day(i), category: cat, kind: "food", food_id: f(name).id, qty, unit });
  if (i % 2) await call("POST", `/days/${day(i)}/close`, { closed: true });
}
const demo = (await call("GET", "/routines")).demos[1];
const dup = await call("POST", `/routines/${demo.routine_key}/duplicate`, {});
const start = await call("POST", "/workouts/start", { routine_key: dup.routine_key, idem: "demo-start" });
for (const [i, it] of start.workout.snapshot.items.slice(0, 2).entries()) for (let s = 0; s < 3; s++) await call("POST", `/workouts/${start.workout.id}/sets`, { exercise_key: it.slug, idem: `demo-${i}-${s}`, reps: 8, load: 10 + i * 5, rest_s: 0 });
await call("POST", `/workouts/${start.workout.id}/finish`, { state: "terminee" });
await call("POST", "/activities", { type: "Marche", date: day(2), duration_min: 40, distance_km: 3.5 });
await call("POST", "/notes", { title: "Repère petit-déjeuner", content: "Les flocons d'avoine le matin me conviennent.", topic: "alimentation", type: "preference" });
console.log(`Données de démonstration créées pour ${EMAIL} (mot de passe : ${PW}). Toutes les données sont fictives.`);
