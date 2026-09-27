"use client";

import { FormEvent, useState } from "react";

const categories = ["SWE", "ML / AI", "Hardware", "Product", "Finance", "Consulting", "Data", "Engineering", "Healthcare", "Marketing / Media", "Government / Policy", "Science / Biotech", "Other"];
const types = [["INFO_SESSION", "Info sessions"], ["COFFEE_CHAT", "Coffee chats"], ["CAREER_FAIR", "Career fairs"], ["DEADLINE", "Deadlines"], ["TECH_TALK", "Tech talks"]];

export function AlertForm({ defaultCompany = "" }: { defaultCompany?: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = (value: string, values: string[], set: (next: string[]) => void) =>
    set(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/alerts", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: data.get("email"), categories: selected, eventTypes,
        companyNames: String(data.get("companies") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
      }),
    });
    const body = await response.json();
    setStatus(body.message ?? body.error ?? "Something went wrong."); setBusy(false);
  }

  return <form className="alert-form" onSubmit={submit}>
    <label>Email<input name="email" type="email" required placeholder="netid@cornell.edu" /></label>
    <fieldset><legend>Career areas <small>Leave blank for all</small></legend><div className="choice-grid">
      {categories.map((value) => <label key={value}><input type="checkbox" checked={selected.includes(value)} onChange={() => toggle(value, selected, setSelected)} /> {value}</label>)}
    </div></fieldset>
    <fieldset><legend>Event types <small>Leave blank for all</small></legend><div className="choice-grid">
      {types.map(([value, label]) => <label key={value}><input type="checkbox" checked={eventTypes.includes(value)} onChange={() => toggle(value, eventTypes, setEventTypes)} /> {label}</label>)}
    </div></fieldset>
    <label>Companies to follow <small>Optional, comma-separated</small><input name="companies" defaultValue={defaultCompany} placeholder="Google, Capital One, JPMorgan" /></label>
    <button className="primary-wide" disabled={busy}>{busy ? "Saving…" : "Create my weekly radar"}</button>
    {status && <p className="form-status" role="status">{status}</p>}
    <p className="form-note">We send a confirmation email first. You can unsubscribe from any digest.</p>
  </form>;
}
