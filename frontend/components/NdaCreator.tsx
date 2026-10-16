"use client";

import { useMemo, useState } from "react";
import { marked } from "marked";
import { buildDocument, defaultForm, missingFields, todayLocal, type NdaForm, type Party } from "@/lib/nda";
import styles from "./NdaCreator.module.css";

type PartyKey = "party1" | "party2";

const PARTY_FIELDS: [key: keyof Party, label: string, type?: string][] = [
  ["name", "Print name"],
  ["title", "Title"],
  ["company", "Company"],
  ["notice", "Notice address (email or postal)"],
  ["date", "Date", "date"],
];

export default function NdaCreator({ standardTerms }: { standardTerms: string }) {
  const [form, setForm] = useState<NdaForm>(defaultForm);

  // The preview and both downloads are derived from the current form on every render,
  // so a download always matches what is displayed.
  const html = useMemo(
    () => marked.parse(buildDocument(standardTerms, form, "html"), { async: false }) as string,
    [form, standardTerms],
  );
  const markdown = useMemo(() => buildDocument(standardTerms, form, "md"), [form, standardTerms]);
  const missing = useMemo(() => missingFields(form), [form]);
  const ready = missing.length === 0;

  const set = <K extends keyof NdaForm>(key: K, value: NdaForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setParty = (which: PartyKey, key: keyof Party, value: string) =>
    setForm((f) => ({ ...f, [which]: { ...f[which], [key]: value } }));

  // Buttons use aria-disabled (so they stay focusable and can point at the missing list),
  // which does not block clicks, so every action goes through this guard.
  const whenReady = (action: () => void) => () => {
    if (ready) action();
  };

  function download(content: string, type: string, filename: string) {
    const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const downloadHtml = () =>
    download(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Mutual NDA</title>` +
        `<style>body{font-family:Georgia,serif;max-width:48rem;margin:2rem auto;padding:0 1rem;line-height:1.5}` +
        `table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:.5rem}.filled{background:#fff3b0}</style>` +
        `</head><body>${html}</body></html>`,
      "text/html",
      "Mutual-NDA.html",
    );

  const actions: { text: string; run: () => void }[] = [
    { text: "Download (.html)", run: downloadHtml },
    { text: "Download (.md)", run: () => download(markdown, "text/markdown", "Mutual-NDA.md") },
    { text: "Print / Save as PDF", run: () => window.print() },
  ];

  const partyFields = (which: PartyKey, label: string) => (
    <fieldset className={styles.fieldset}>
      <legend>{label}</legend>
      {PARTY_FIELDS.map(([key, text, type]) => (
        <label key={key}>
          {text}
          <input
            type={type}
            value={form[which][key]}
            onChange={(e) => setParty(which, key, e.target.value)}
          />
        </label>
      ))}
    </fieldset>
  );

  return (
    <main className={styles.layout}>
      <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
        <h1>Mutual NDA Creator</h1>
        <p className={styles.hint}>Fill in the key terms. The agreement on the right updates as you type.</p>

        <label>
          Purpose
          <textarea rows={3} value={form.purpose} onChange={(e) => set("purpose", e.target.value)} />
        </label>
        <div className={styles.field}>
          <label>
            Effective date
            <input type="date" value={form.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} />
          </label>
          <button type="button" className={styles.link} onClick={() => set("effectiveDate", todayLocal())}>
            Use today’s date
          </button>
        </div>

        <fieldset className={styles.fieldset}>
          <legend>MNDA term</legend>
          <label className={styles.inline}>
            <input type="radio" checked={form.termType === "expires"} onChange={() => set("termType", "expires")} />
            Expires after
            <input
              type="number"
              min={1}
              aria-label="MNDA term in years"
              className={styles.num}
              value={form.termYears}
              onChange={(e) => set("termYears", e.target.value)}
              disabled={form.termType !== "expires"}
            />
            year(s)
          </label>
          <label className={styles.inline}>
            <input
              type="radio"
              checked={form.termType === "untilTerminated"}
              onChange={() => set("termType", "untilTerminated")}
            />
            Continues until terminated
          </label>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Term of confidentiality</legend>
          <label className={styles.inline}>
            <input
              type="radio"
              checked={form.confidentialityType === "years"}
              onChange={() => set("confidentialityType", "years")}
            />
            For
            <input
              type="number"
              min={1}
              aria-label="Confidentiality term in years"
              className={styles.num}
              value={form.confidentialityYears}
              onChange={(e) => set("confidentialityYears", e.target.value)}
              disabled={form.confidentialityType !== "years"}
            />
            year(s) (trade secrets protected longer)
          </label>
          <label className={styles.inline}>
            <input
              type="radio"
              checked={form.confidentialityType === "perpetuity"}
              onChange={() => set("confidentialityType", "perpetuity")}
            />
            In perpetuity
          </label>
        </fieldset>

        <label>
          Governing law (state)
          <input
            value={form.governingLaw}
            placeholder="e.g. Delaware"
            onChange={(e) => set("governingLaw", e.target.value)}
          />
        </label>
        <label>
          Jurisdiction (city/county and state)
          <input
            value={form.jurisdiction}
            placeholder="e.g. New Castle, DE"
            onChange={(e) => set("jurisdiction", e.target.value)}
          />
        </label>
        <label>
          MNDA modifications (optional)
          <textarea rows={3} value={form.modifications} onChange={(e) => set("modifications", e.target.value)} />
        </label>

        {partyFields("party1", "Party 1")}
        {partyFields("party2", "Party 2")}
      </form>

      <section className={styles.previewPane}>
        <p role="status" className={ready ? styles.ready : styles.missingSummary}>
          {ready
            ? "Ready to download."
            : `${missing.length} required field${missing.length === 1 ? "" : "s"} still to complete before you can download.`}
        </p>
        {!ready && (
          <ul id="missing-fields" className={styles.missing}>
            {missing.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        )}
        <div className={styles.actions}>
          {actions.map(({ text, run }) => (
            <button
              key={text}
              type="button"
              aria-disabled={!ready}
              aria-describedby={ready ? undefined : "missing-fields"}
              onClick={whenReady(run)}
            >
              {text}
            </button>
          ))}
        </div>
        <article className={styles.preview} dangerouslySetInnerHTML={{ __html: html }} />
      </section>
    </main>
  );
}
