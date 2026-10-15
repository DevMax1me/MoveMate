"use client";
import Mascot from "./Mascot";
import { useEffect, useState, type ReactNode } from "react";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row spread" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}><h2 style={{ margin: 0, minWidth: 0, overflowWrap: "anywhere" }}>{title}</h2><button className="ghost" onClick={onClose} aria-label="Fermer" style={{ flex: "none" }}>✕</button></div>
        <div style={{ marginTop: 10 }}>{children}</div>
      </div>
    </div>
  );
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <div className="field"><label>{label}{hint && <span className="small"> — {hint}</span>}</label>{children}</div>;
}
export const Notice = ({ kind = "warn", children }: { kind?: "warn" | "err" | "okk" | "info"; children: ReactNode }) => <div className={`notice ${kind === "warn" ? "" : kind}`} role={kind === "err" ? "alert" : "status"}>{children}</div>;
export const Empty = ({ children, mood = "sleepy" }: { children: ReactNode; mood?: "happy" | "sleepy" | "wink" | "cheer" }) => <div className="empty"><Mascot mood={mood} size={52} /><div>{children}</div></div>;
export const Loading = () => <p className="muted" role="status">Chargement…</p>;
export const ErrorBox = ({ error, retry }: { error: string; retry?: () => void }) => <div className="notice err" role="alert">{error} {retry && <button onClick={retry}>Réessayer</button>}</div>;

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (v: T) => void }) {
  return <div className="tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}>{l}</button>)}</div>;
}

let pushToast: (m: string) => void = () => {};
export const toast = (m: string) => pushToast(m);
export function Toaster() {
  const [m, setM] = useState<string | null>(null);
  useEffect(() => { pushToast = (x) => { setM(x); setTimeout(() => setM(null), 3500); }; }, []);
  return m ? <div className="toast" role="status" aria-live="polite">{m}</div> : null;
}
