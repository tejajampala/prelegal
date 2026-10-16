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

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const blank = "\\_\\_\\_\\_\\_\\_\\_\\_";

// Escaped for safe embedding in markdown/HTML; falls back to a blank line when empty.
const val = (s: string) => (s.trim() ? escapeHtml(s.trim()) : blank);

const years = (n: string) => `${val(n)} year(s)`;

function formatDate(iso: string) {
  if (!iso) return blank;
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime())
    ? blank
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

const cell = (s: string) =>
  s.trim() ? escapeHtml(s.trim()).replace(/\|/g, "&#124;").replace(/\n/g, " ") : "&nbsp;";

export function buildCoverPage(f: NdaForm): string {
  const term =
    f.termType === "expires"
      ? `Expires ${years(f.termYears)} from Effective Date.`
      : "Continues until terminated in accordance with the terms of the MNDA.";
  const conf =
    f.confidentialityType === "years"
      ? `${years(f.confidentialityYears)} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`
      : "In perpetuity.";

  return `# Mutual Non-Disclosure Agreement

## USING THIS MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“**Cover Page**”) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 (“**Standard Terms**”) identical to those posted at [commonpaper.com/standards/mutual-nda/1.0](https://commonpaper.com/standards/mutual-nda/1.0). Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.

### Purpose
*How Confidential Information may be used*

${val(f.purpose)}

### Effective Date
${formatDate(f.effectiveDate)}

### MNDA Term
*The length of this MNDA*

${term}

### Term of Confidentiality
*How long Confidential Information is protected*

${conf}

### Governing Law & Jurisdiction
Governing Law: ${val(f.governingLaw)}

Jurisdiction: ${val(f.jurisdiction)}

### MNDA Modifications
${f.modifications.trim() ? escapeHtml(f.modifications.trim()) : "None."}

By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.

|  | PARTY 1 | PARTY 2 |
|:--- | :----: | :----: |
| Signature | &nbsp; | &nbsp; |
| Print Name | ${cell(f.party1.name)} | ${cell(f.party2.name)} |
| Title | ${cell(f.party1.title)} | ${cell(f.party2.title)} |
| Company | ${cell(f.party1.company)} | ${cell(f.party2.company)} |
| Notice Address | ${cell(f.party1.notice)} | ${cell(f.party2.notice)} |
| Date | ${cell(f.party1.date)} | ${cell(f.party2.date)} |

Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
`;
}

// Fills the defined terms used in the Standard Terms with the values from the form.
export function buildStandardTerms(raw: string, f: NdaForm): string {
  const fill: Record<string, string> = {
    Purpose: val(f.purpose),
    "Effective Date": formatDate(f.effectiveDate),
    "MNDA Term":
      f.termType === "expires"
        ? `${years(f.termYears)} from the Effective Date`
        : "period until terminated",
    "Term of Confidentiality":
      f.confidentialityType === "years"
        ? `${years(f.confidentialityYears)} from the Effective Date`
        : "perpetuity",
    "Governing Law": val(f.governingLaw),
    Jurisdiction: val(f.jurisdiction),
  };
  return raw.replace(
    /<span class="coverpage_link">([^<]+)<\/span>/g,
    (m, key: string) => (key in fill ? `<span class="filled">${fill[key]}</span>` : m),
  );
}
