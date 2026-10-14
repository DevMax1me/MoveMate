"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, useApi, fmtDate, shiftDate, nf, uuid } from "@/lib/client";
import { useMe } from "@/components/Shell";
import { DayCard } from "@/components/DayMeals";
import MealAdder from "@/components/MealAdder";
import WeightForm from "@/components/WeightForm";
import { ErrorBox, Loading, Notice, toast } from "@/components/ui";

export default function Today() {
  const me = useMe();
  const router = useRouter();
  const [date, setDate] = useState(me.today);
  const { data, error, loading, reload } = useApi<any>(`/stats/today?date=${date}`);
  const [adding, setAdding] = useState<string | null | undefined>(undefined);
  const [showWeight, setShowWeight] = useState(false);
  async function start(p: any) {
    try { await api("/workouts/start", { body: { routine_key: p.routine_key, planned_id: p.id, idem: uuid() } }); router.push("/training"); } catch (e: any) { if (e.status === 409) router.push("/training"); else toast(e.message); }
  }
  return (
    <div>
      <div className="row spread"><h1 style={{ margin: 0 }}>{date === me.today ? "Aujourd’hui" : "Journal"}</h1>
        <div className="row"><button onClick={() => setDate(shiftDate(date, -1))} aria-label="Jour précédent">‹</button><button onClick={() => setDate(me.today)} disabled={date === me.today}>Aujourd’hui</button><button onClick={() => setDate(shiftDate(date, 1))} aria-label="Jour suivant">›</button></div></div>
      <p className="muted cap">{fmtDate(date)}</p>
      {error && <ErrorBox error={error} retry={reload} />}
      {!data ? (loading ? <Loading /> : null) : <>
        <div className="grid g2" style={{ marginTop: 8 }}>
          <div>
            <DayCard day={data.day} date={date} reload={reload} onAdd={(c) => setAdding(c ?? null)} />
          </div>
          <div className="stack">
            <div className="card">
              <h2 style={{ margin: 0 }}>Séance</h2>
              {data.activeWorkout ? <div><p>Une séance est en cours : <b>{data.activeWorkout.name}</b></p><Link className="btn primary" href="/training">Reprendre la séance</Link></div>
                : data.planned.length ? data.planned.map((p: any) => <div className="item" key={p.id}><div className="grow"><b>{p.routine_name}</b><div className="small muted">prévue {p.status === "reporte" ? "(reportée)" : "aujourd’hui"}</div></div><button className="primary" onClick={() => start(p)}>Démarrer</button></div>)
                  : <div><p className="muted">Aucune séance prévue.</p><div className="row"><Link className="btn primary" href="/training">Démarrer une routine</Link><Link className="btn" href="/training">Séance libre</Link></div></div>}
            </div>
            <div className="card">
              <div className="row spread"><h2 style={{ margin: 0 }}>Pesée</h2><button className="ghost" onClick={() => setShowWeight(!showWeight)}>{showWeight ? "Fermer" : "＋ Ajouter"}</button></div>
              {data.todayWeights.length ? <p><span className="big">{nf(data.todayWeights.find((w: any) => w.is_ref)?.kg ?? data.todayWeights[0].kg, 2)}</span><span className="unit">kg (référence du jour)</span></p> : <p className="muted">Pas de pesée ce jour.</p>}
              {data.weight.movingAverage.insufficient ? <p className="small muted">Données insuffisantes pour la tendance ({data.weight.movingAverage.days}/7 jours mesurés, 3 minimum).</p> : <p className="small">Moyenne mobile 7 jours : <b>{nf(data.weight.movingAverage.avg, 2)} kg</b> <span className="muted">({data.weight.movingAverage.days} jours mesurés sur 7)</span></p>}
              {showWeight && <WeightForm date={date} onSaved={() => { setShowWeight(false); reload(); }} />}
              {!data.todayWeights.length && !showWeight && <button onClick={() => setShowWeight(true)}>Ajouter une pesée</button>}
            </div>
            {data.priorities && <div className="card"><h2 style={{ margin: 0 }}>Priorités de la semaine</h2>{data.priorities.items.map((p: any, i: number) => <div className="item" key={i}><div className="grow"><b>{p.action}</b><div className="small muted">{p.effort} · {p.slot}</div></div></div>)}</div>}
            {!data.goal && <Notice kind="info">Aucune cible calorique : les apports s’affichent sans « reste ». Vous pouvez en définir une dans <Link href="/account">Mon compte</Link>, ou continuer sans.</Notice>}
          </div>
        </div>
      </>}
      {adding !== undefined && <MealAdder date={date} defaultCategory={adding ?? undefined} onClose={() => setAdding(undefined)} onAdded={reload} />}
    </div>
  );
}
