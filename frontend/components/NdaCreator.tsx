"use client";

import { useMemo, useState } from "react";
import { marked } from "marked";
import { buildCoverPage, buildStandardTerms, defaultForm, type NdaForm, type Party } from "@/lib/nda";
import styles from "./NdaCreator.module.css";

type PartyKey = "party1" | "party2";

export default function NdaCreator({ standardTerms }: { standardTerms: string }) {
  const [form, setForm] = useState<NdaForm>(defaultForm);

  const markdown = useMemo(
    () => `${buildCoverPage(form)}\n\n---\n\n${buildStandardTerms(standardTerms, form)}`,
    [form, standardTerms],
  );
  const html = useMemo(() => marked.parse(markdown, { async: false }) as string, [markdown]);

  const set = <K extends keyof NdaForm>(key: K, value: NdaForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setParty = (which: PartyKey, key: keyof Party, value: string) =>
    setForm((f) => ({ ...f, [which]: { ...f[which], [key]: value } }));

  function download(content: string, type: string, filename: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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

  const partyFields = (which: PartyKey, label: string) => (
    <fieldset className={styles.fieldset}>
      <legend>{label}</legend>
      <label>
        Print name
        <input value={form[which].name} onChange={(e) => setParty(which, "name", e.target.value)} />
      </label>
      <label>
        Title
        <input value={form[which].title} onChange={(e) => setParty(which, "title", e.target.value)} />
      </label>
      <label>
        Company
        <input value={form[which].company} onChange={(e) => setParty(which, "company", e.target.value)} />
      </label>
      <label>
        Notice address (email or postal)
        <input value={form[which].notice} onChange={(e) => setParty(which, "notice", e.target.value)} />
      </label>
      <label>
        Date
        <input type="date" value={form[which].date} onChange={(e) => setParty(which, "date", e.target.value)} />
      </label>
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
        <label>
          Effective date
          <input type="date" value={form.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} />
          <button type="button" className={styles.link} onClick={() => set("effectiveDate", new Date().toISOString().slice(0, 10))}>
            Use today’s date
          </button>
        </label>

        <fieldset className={styles.fieldset}>
          <legend>MNDA term</legend>
          <label className={styles.inline}>
            <input type="radio" checked={form.termType === "expires"} onChange={() => set("termType", "expires")} />
            Expires after
            <input
              type="number"
              min={1}
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
        <div className={styles.actions}>
          <button type="button" onClick={downloadHtml}>
            Download (.html)
          </button>
          <button type="button" onClick={() => download(markdown, "text/markdown", "Mutual-NDA.md")}>
            Download (.md)
          </button>
          <button type="button" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
        <article className={styles.preview} dangerouslySetInnerHTML={{ __html: html }} />
      </section>
    </main>
  );
}
