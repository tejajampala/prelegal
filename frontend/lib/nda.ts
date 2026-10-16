export type Party = {
  name: string;
  title: string;
  company: string;
  notice: string;
  date: string;
};

export type NdaForm = {
  purpose: string;
  effectiveDate: string;
  termType: "expires" | "untilTerminated";
  termYears: string;
  confidentialityType: "years" | "perpetuity";
  confidentialityYears: string;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: Party;
  party2: Party;
};

// "html" feeds the on-screen preview and the .html download; "md" produces a plain markdown file.
export type Mode = "html" | "md";

const emptyParty: Party = { name: "", title: "", company: "", notice: "", date: "" };

export function defaultForm(): NdaForm {
  return {
    purpose: "Evaluating whether to enter into a business relationship with the other party.",
    effectiveDate: "",
    termType: "expires",
    termYears: "1",
    confidentialityType: "years",
    confidentialityYears: "1",
    governingLaw: "",
    jurisdiction: "",
    modifications: "",
    party1: { ...emptyParty },
    party2: { ...emptyParty },
  };
}

// Local date as YYYY-MM-DD (toISOString would give the UTC date).
export function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const filled = (s: string) => s.trim() !== "";
const positiveInt = (s: string) => /^[1-9]\d*$/.test(s.trim());

const CHECKS: [label: string, ok: (f: NdaForm) => boolean][] = [
  ["Purpose", (f) => filled(f.purpose)],
  ["Effective date", (f) => filled(f.effectiveDate)],
  ["MNDA term (whole years)", (f) => f.termType !== "expires" || positiveInt(f.termYears)],
  [
    "Term of confidentiality (whole years)",
    (f) => f.confidentialityType !== "years" || positiveInt(f.confidentialityYears),
  ],
  ["Governing law", (f) => filled(f.governingLaw)],
  ["Jurisdiction", (f) => filled(f.jurisdiction)],
  ["Party 1 name", (f) => filled(f.party1.name)],
  ["Party 1 company", (f) => filled(f.party1.company)],
  ["Party 1 date", (f) => filled(f.party1.date)],
  ["Party 2 name", (f) => filled(f.party2.name)],
  ["Party 2 company", (f) => filled(f.party2.company)],
  ["Party 2 date", (f) => filled(f.party2.date)],
];

// Labels of required fields that are empty or invalid, in form order.
export function missingFields(f: NdaForm): string[] {
  return CHECKS.filter(([, ok]) => !ok(f)).map(([label]) => label);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Also escapes line-leading list/rule/heading markers so multi-line text can't become a list or rule.
const escapeMd = (s: string) =>
  s
    .replace(/[\\`*_[\]<>|#~]/g, "\\$&")
    .replace(/^(\s*)([-+=])/gm, "$1\\$2")
    .replace(/^(\s*\d+)([.)])/gm, "$1\\$2");

// User text is neutralised for both HTML and markdown so it renders literally in either output.
const escapeFor = (s: string, m: Mode) => (m === "html" ? escapeMd(escapeHtml(s)) : escapeMd(s));

const blank = "\\_\\_\\_\\_\\_\\_\\_\\_";

const val = (s: string, m: Mode) => (s.trim() ? escapeFor(s.trim(), m) : blank);

const years = (n: string, m: Mode) => `${val(n, m)} year(s)`;

function formatDate(iso: string) {
  if (!iso) return blank;
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime())
    ? blank
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

const emptyCell = (m: Mode) => (m === "html" ? "&nbsp;" : "");

const cell = (s: string, m: Mode) =>
  s.trim() ? escapeFor(s.trim(), m).replace(/\s*\n\s*/g, " ") : emptyCell(m);

// Unlike formatDate, an empty date leaves the table cell empty rather than showing a blank line.
const dateCell = (iso: string, m: Mode) => (iso ? cell(formatDate(iso), m) : emptyCell(m));

const box = (checked: boolean) => (checked ? "[x]" : "[ ]");

export function buildCoverPage(f: NdaForm, m: Mode = "html"): string {
  const expires = f.termType === "expires";
  const yearsConf = f.confidentialityType === "years";

  return `# Mutual Non-Disclosure Agreement

## USING THIS MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“**Cover Page**”) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 (“**Standard Terms**”) identical to those posted at [commonpaper.com/standards/mutual-nda/1.0](https://commonpaper.com/standards/mutual-nda/1.0). Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.

### Purpose
*How Confidential Information may be used*

${val(f.purpose, m)}

### Effective Date
${formatDate(f.effectiveDate)}

### MNDA Term
*The length of this MNDA*

- ${box(expires)} Expires ${years(f.termYears, m)} from Effective Date.
- ${box(!expires)} Continues until terminated in accordance with the terms of the MNDA.

### Term of Confidentiality
*How long Confidential Information is protected*

- ${box(yearsConf)} ${years(f.confidentialityYears, m)} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.
- ${box(!yearsConf)} In perpetuity.

### Governing Law & Jurisdiction
Governing Law: ${val(f.governingLaw, m)}

Jurisdiction: ${val(f.jurisdiction, m)}

### MNDA Modifications
${f.modifications.trim() ? escapeFor(f.modifications.trim(), m) : "None."}

By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.

|  | PARTY 1 | PARTY 2 |
|:--- | :----: | :----: |
| Signature | ${emptyCell(m)} | ${emptyCell(m)} |
| Print Name | ${cell(f.party1.name, m)} | ${cell(f.party2.name, m)} |
| Title | ${cell(f.party1.title, m)} | ${cell(f.party2.title, m)} |
| Company | ${cell(f.party1.company, m)} | ${cell(f.party2.company, m)} |
| Notice Address *(use either email or postal address)* | ${cell(f.party1.notice, m)} | ${cell(f.party2.notice, m)} |
| Date | ${dateCell(f.party1.date, m)} | ${dateCell(f.party2.date, m)} |

Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
`;
}

// Fills the defined terms used in the Standard Terms with the values from the form.
export function buildStandardTerms(raw: string, f: NdaForm, m: Mode = "html"): string {
  const fill: Record<string, string> = {
    Purpose: val(f.purpose, m),
    "Effective Date": formatDate(f.effectiveDate),
    "MNDA Term": f.termType === "expires" ? `${years(f.termYears, m)} from the Effective Date` : "period until terminated",
    "Term of Confidentiality":
      f.confidentialityType === "years" ? `${years(f.confidentialityYears, m)} from the Effective Date` : "perpetuity",
    "Governing Law": val(f.governingLaw, m),
    Jurisdiction: val(f.jurisdiction, m),
  };
  return raw.replace(/<span class="coverpage_link">([^<]+)<\/span>/g, (match, key: string) => {
    if (!(key in fill)) return match;
    return m === "html" ? `<span class="filled">${fill[key]}</span>` : fill[key];
  });
}

export function buildDocument(standardTerms: string, f: NdaForm, m: Mode = "html"): string {
  return `${buildCoverPage(f, m)}\n\n---\n\n${buildStandardTerms(standardTerms, f, m)}`;
}
