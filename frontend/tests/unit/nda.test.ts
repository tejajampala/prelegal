import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCoverPage,
  buildDocument,
  buildStandardTerms,
  defaultForm,
  missingFields,
  todayLocal,
  type NdaForm,
} from "../../lib/nda";

const templatesDir = path.join(__dirname, "..", "..", "..", "templates");
const standardTerms = fs.readFileSync(path.join(templatesDir, "Mutual-NDA.md"), "utf8");

function completeForm(overrides: Partial<NdaForm> = {}): NdaForm {
  const f = defaultForm();
  f.effectiveDate = "2026-10-17";
  f.governingLaw = "Delaware";
  f.jurisdiction = "New Castle, DE";
  f.party1 = { name: "Alice", title: "CEO", company: "Acme", notice: "alice@acme.test", date: "2026-10-18" };
  f.party2 = { name: "Bob", title: "CTO", company: "Globex", notice: "1 Main St", date: "2026-10-19" };
  return { ...f, ...overrides };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("defaultForm", () => {
  it("starts with a purpose, 1-year terms and empty required values", () => {
    const f = defaultForm();
    expect(f.purpose).toMatch(/Evaluating whether/);
    expect(f.termType).toBe("expires");
    expect(f.termYears).toBe("1");
    expect(f.confidentialityType).toBe("years");
    expect(f.confidentialityYears).toBe("1");
    expect(f.effectiveDate).toBe("");
    expect(f.party1.name).toBe("");
  });

  it("returns independent objects each call", () => {
    const a = defaultForm();
    const b = defaultForm();
    a.party1.name = "changed";
    expect(b.party1.name).toBe("");
  });
});

describe("todayLocal", () => {
  it("uses the local calendar date, zero-padded", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 9, 0, 0));
    expect(todayLocal()).toBe("2026-01-05");
  });

  it("does not roll over to the UTC date late in the local day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 0));
    expect(todayLocal()).toBe("2026-12-31");
  });

  it("does not roll back to the UTC date early in the local day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 1, 0, 1, 0));
    expect(todayLocal()).toBe("2026-03-01");
  });
});

describe("missingFields", () => {
  it("lists every required field on a blank form, in form order", () => {
    expect(missingFields(defaultForm())).toEqual([
      "Effective date",
      "Governing law",
      "Jurisdiction",
      "Party 1 name",
      "Party 1 company",
      "Party 1 date",
      "Party 2 name",
      "Party 2 company",
      "Party 2 date",
    ]);
  });

  it("returns nothing for a complete form", () => {
    expect(missingFields(completeForm())).toEqual([]);
  });

  it("does not require optional fields", () => {
    const f = completeForm();
    f.modifications = "";
    f.party1.title = "";
    f.party1.notice = "";
    f.party2.title = "";
    f.party2.notice = "";
    expect(missingFields(f)).toEqual([]);
  });

  it.each([
    ["purpose", (f: NdaForm) => (f.purpose = ""), "Purpose"],
    ["effective date", (f: NdaForm) => (f.effectiveDate = ""), "Effective date"],
    ["governing law", (f: NdaForm) => (f.governingLaw = ""), "Governing law"],
    ["jurisdiction", (f: NdaForm) => (f.jurisdiction = ""), "Jurisdiction"],
    ["party 1 name", (f: NdaForm) => (f.party1.name = ""), "Party 1 name"],
    ["party 1 company", (f: NdaForm) => (f.party1.company = ""), "Party 1 company"],
    ["party 1 date", (f: NdaForm) => (f.party1.date = ""), "Party 1 date"],
    ["party 2 name", (f: NdaForm) => (f.party2.name = ""), "Party 2 name"],
    ["party 2 company", (f: NdaForm) => (f.party2.company = ""), "Party 2 company"],
    ["party 2 date", (f: NdaForm) => (f.party2.date = ""), "Party 2 date"],
  ])("flags a blank %s", (_name, clear, label) => {
    const f = completeForm();
    clear(f);
    expect(missingFields(f)).toEqual([label]);
  });

  it("treats whitespace-only values as missing", () => {
    const f = completeForm({ governingLaw: "   ", jurisdiction: "\n\t" });
    expect(missingFields(f)).toEqual(["Governing law", "Jurisdiction"]);
  });

  describe("year fields", () => {
    it.each(["", " ", "0", "-1", "1.5", "abc", "1e3", "01", "+2"])("rejects MNDA term years %j", (v) => {
      expect(missingFields(completeForm({ termYears: v }))).toEqual(["MNDA term (whole years)"]);
    });

    it.each(["1", "2", "10", " 3 ", "100"])("accepts MNDA term years %j", (v) => {
      expect(missingFields(completeForm({ termYears: v }))).toEqual([]);
    });

    it.each(["", "0", "-4", "2.5", "x"])("rejects confidentiality years %j", (v) => {
      expect(missingFields(completeForm({ confidentialityYears: v }))).toEqual([
        "Term of confidentiality (whole years)",
      ]);
    });

    it("ignores an invalid MNDA term when 'until terminated' is selected", () => {
      expect(missingFields(completeForm({ termType: "untilTerminated", termYears: "" }))).toEqual([]);
    });

    it("ignores invalid confidentiality years when 'perpetuity' is selected", () => {
      expect(missingFields(completeForm({ confidentialityType: "perpetuity", confidentialityYears: "0" }))).toEqual(
        [],
      );
    });

    it("reports both when both are invalid", () => {
      expect(missingFields(completeForm({ termYears: "0", confidentialityYears: "0" }))).toEqual([
        "MNDA term (whole years)",
        "Term of confidentiality (whole years)",
      ]);
    });
  });
});

describe("buildCoverPage", () => {
  it("fills the core terms in html mode", () => {
    const md = buildCoverPage(completeForm(), "html");
    expect(md).toContain("# Mutual Non-Disclosure Agreement");
    expect(md).toContain("### Effective Date\nOctober 17, 2026");
    expect(md).toContain("Governing Law: Delaware");
    expect(md).toContain("Jurisdiction: New Castle, DE");
    expect(md).toContain("| Print Name | Alice | Bob |");
    expect(md).toContain("| Company | Acme | Globex |");
    expect(md).toContain("| Date | October 18, 2026 | October 19, 2026 |");
  });

  it("keeps the template intro and footer", () => {
    const md = buildCoverPage(completeForm());
    expect(md).toContain("Common Paper Mutual NDA Standard Terms Version 1.0");
    expect(md).toContain("free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)");
    expect(md).toContain("By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.");
  });

  describe("checkbox options", () => {
    it("checks 'expires' and 'years' by default", () => {
      const md = buildCoverPage(completeForm());
      expect(md).toContain("- [x] Expires 1 year(s) from Effective Date.");
      expect(md).toContain("- [ ] Continues until terminated in accordance with the terms of the MNDA.");
      expect(md).toMatch(/- \[x\] 1 year\(s\) from Effective Date, but in the case of trade secrets/);
      expect(md).toContain("- [ ] In perpetuity.");
    });

    it("flips the MNDA term selection", () => {
      const md = buildCoverPage(completeForm({ termType: "untilTerminated" }));
      expect(md).toContain("- [ ] Expires 1 year(s) from Effective Date.");
      expect(md).toContain("- [x] Continues until terminated");
    });

    it("flips the confidentiality selection", () => {
      const md = buildCoverPage(completeForm({ confidentialityType: "perpetuity" }));
      expect(md).toMatch(/- \[ \] 1 year\(s\) from Effective Date, but in the case of trade secrets/);
      expect(md).toContain("- [x] In perpetuity.");
    });

    it("always renders exactly four options with exactly two checked", () => {
      for (const termType of ["expires", "untilTerminated"] as const) {
        for (const confidentialityType of ["years", "perpetuity"] as const) {
          const md = buildCoverPage(completeForm({ termType, confidentialityType }));
          expect(md.match(/^- \[[ x]\]/gm)).toHaveLength(4);
          expect(md.match(/^- \[x\]/gm)).toHaveLength(2);
        }
      }
    });

    it("uses the entered number of years", () => {
      const md = buildCoverPage(completeForm({ termYears: "3", confidentialityYears: "7" }));
      expect(md).toContain("Expires 3 year(s) from Effective Date.");
      expect(md).toContain("- [x] 7 year(s) from Effective Date");
    });
  });

  it("includes hint text", () => {
    const md = buildCoverPage(completeForm());
    expect(md).toContain("*How Confidential Information may be used*");
    expect(md).toContain("*The length of this MNDA*");
    expect(md).toContain("*How long Confidential Information is protected*");
    expect(md).toContain("Notice Address *(use either email or postal address)*");
  });

  it("shows blank placeholders for missing values", () => {
    const md = buildCoverPage(defaultForm());
    const blank = "\\_\\_\\_\\_\\_\\_\\_\\_";
    expect(md).toContain(`### Effective Date\n${blank}`);
    expect(md).toContain(`Governing Law: ${blank}`);
    expect(md).toContain(`Jurisdiction: ${blank}`);
  });

  it("shows a blank for an unparseable effective date", () => {
    const md = buildCoverPage(completeForm({ effectiveDate: "not-a-date" }));
    expect(md).toContain("### Effective Date\n\\_\\_\\_\\_\\_\\_\\_\\_");
  });

  it("says 'None.' when there are no modifications", () => {
    expect(buildCoverPage(completeForm())).toContain("### MNDA Modifications\nNone.");
  });

  it("includes entered modifications", () => {
    const md = buildCoverPage(completeForm({ modifications: "Term is extended." }));
    expect(md).toContain("### MNDA Modifications\nTerm is extended.");
  });

  describe("empty table cells", () => {
    it("use &nbsp; in html mode", () => {
      const f = completeForm();
      f.party1.title = "";
      const html = buildCoverPage(f, "html");
      expect(html).toContain("| Title | &nbsp; | CTO |");
      expect(html).toContain("| Signature | &nbsp; | &nbsp; |");
    });

    it("are truly empty in md mode", () => {
      const f = completeForm();
      f.party1.title = "";
      const md = buildCoverPage(f, "md");
      expect(md).toContain("| Title |  | CTO |");
      expect(md).toContain("| Signature |  |  |");
      expect(md).not.toContain("&nbsp;");
    });

    it("leave an unset party date empty rather than a blank line", () => {
      const f = completeForm();
      f.party1.date = "";
      expect(buildCoverPage(f, "md")).toContain("| Date |  | October 19, 2026 |");
    });
  });

  it("produces a well-formed 3-column table (every row has 4 pipes)", () => {
    const rows = buildCoverPage(completeForm(), "md")
      .split("\n")
      .filter((l) => l.startsWith("|"));
    expect(rows).toHaveLength(8);
    for (const r of rows) expect(r.match(/(?<!\\)\|/g)).toHaveLength(4);
  });
});

describe("escaping of user text", () => {
  const hostile = 'A *b* _c_ `d` [e](http://x) <script>alert(1)</script> | # ~ "q" & \\';

  it("html mode never emits raw angle brackets from user input", () => {
    const f = completeForm({ purpose: hostile, governingLaw: hostile, modifications: hostile });
    f.party1.name = hostile;
    const doc = buildDocument(standardTerms, f, "html");
    expect(doc).not.toContain("<script");
    expect(doc).not.toMatch(/<img/);
    expect(doc).toContain("&lt;script&gt;");
  });

  it("html mode escapes ampersands so typed entities display literally", () => {
    const md = buildCoverPage(completeForm({ governingLaw: "&lt;b&gt;" }), "html");
    expect(md).toContain("Governing Law: &amp;lt;b&amp;gt;");
  });

  it("md mode backslash-escapes markdown metacharacters", () => {
    const md = buildCoverPage(completeForm({ governingLaw: "*a* _b_ `c` [d] #e ~f" }), "md");
    expect(md).toContain("Governing Law: \\*a\\* \\_b\\_ \\`c\\` \\[d\\] \\#e \\~f");
  });

  it("md mode escapes angle brackets instead of using entities", () => {
    const md = buildCoverPage(completeForm({ governingLaw: "<b>x</b>" }), "md");
    expect(md).toContain("Governing Law: \\<b\\>x\\</b\\>");
    expect(md).not.toMatch(/&[a-z#0-9]+;/);
  });

  it("escapes pipes so they cannot break table rows", () => {
    const f = completeForm();
    f.party1.name = "a | b";
    expect(buildCoverPage(f, "md")).toContain("| Print Name | a \\| b | Bob |");
  });

  it("collapses newlines inside table cells", () => {
    const f = completeForm();
    f.party1.notice = "1 Main St\nSpringfield\n  USA";
    const md = buildCoverPage(f, "md");
    expect(md).toContain("| Notice Address *(use either email or postal address)* | 1 Main St Springfield USA | 1 Main St |");
  });

  it("escapes line-leading list, rule and setext markers in multi-line text", () => {
    const md = buildCoverPage(completeForm({ modifications: "- item\n+ item\n1. one\n2) two\n---\n===" }), "md");
    expect(md).toContain("\\- item\n\\+ item\n1\\. one\n2\\) two\n\\---\n\\===");
  });

  it("does not escape ordinary hyphens and numbers mid-line", () => {
    const md = buildCoverPage(completeForm({ governingLaw: "New-York 2026" }), "md");
    expect(md).toContain("Governing Law: New-York 2026");
  });

  it("trims surrounding whitespace", () => {
    expect(buildCoverPage(completeForm({ governingLaw: "  Texas  " }), "md")).toContain("Governing Law: Texas\n");
  });
});

describe("buildStandardTerms", () => {
  it("replaces every coverpage_link span with the matching value (html mode)", () => {
    const out = buildStandardTerms(standardTerms, completeForm(), "html");
    expect(out).not.toContain('class="coverpage_link"');
    expect(out).toContain('<span class="filled">Delaware</span>');
    expect(out).toContain('<span class="filled">New Castle, DE</span>');
    expect(out).toContain('<span class="filled">October 17, 2026</span>');
    expect(out).toContain('<span class="filled">1 year(s) from the Effective Date</span>');
  });

  it("emits plain text with no spans in md mode", () => {
    const out = buildStandardTerms(standardTerms, completeForm(), "md");
    expect(out).not.toContain("<span");
    expect(out).toContain("laws of the State of Delaware");
    expect(out).toContain("located in New Castle, DE");
  });

  it("leaves non-span template text untouched", () => {
    const out = buildStandardTerms(standardTerms, completeForm(), "md");
    expect(out).toContain("# Standard Terms");
    expect(out).toContain("**Disclaimer**");
    expect(out).toContain("Version 1.0");
  });

  it("describes a perpetual confidentiality term", () => {
    const out = buildStandardTerms(standardTerms, completeForm({ confidentialityType: "perpetuity" }), "md");
    expect(out).toContain("will survive for the perpetuity");
  });

  it("describes a term that continues until terminated", () => {
    const out = buildStandardTerms(standardTerms, completeForm({ termType: "untilTerminated" }), "md");
    expect(out).toContain("expires at the end of the period until terminated");
  });

  it("fills blank placeholders when values are missing", () => {
    const out = buildStandardTerms(standardTerms, defaultForm(), "md");
    expect(out).toContain("\\_\\_\\_\\_\\_\\_\\_\\_");
  });

  it("leaves spans with unknown keys unchanged", () => {
    const raw = 'See <span class="coverpage_link">Unknown Thing</span> here.';
    expect(buildStandardTerms(raw, completeForm(), "html")).toBe(raw);
    expect(buildStandardTerms(raw, completeForm(), "md")).toBe(raw);
  });

  it("handles repeated keys (Purpose, Jurisdiction appear several times)", () => {
    const out = buildStandardTerms(standardTerms, completeForm({ purpose: "Testing" }), "md");
    expect(out.match(/Testing/g)!.length).toBeGreaterThanOrEqual(2);
  });

  it("html-escapes user text before inserting into spans", () => {
    const out = buildStandardTerms(standardTerms, completeForm({ governingLaw: "<img src=x onerror=1>" }), "html");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
  });
});

describe("template contract", () => {
  it("every coverpage_link key in Mutual-NDA.md is one the app fills", () => {
    const keys = new Set([...standardTerms.matchAll(/<span class="coverpage_link">([^<]+)<\/span>/g)].map((m) => m[1]));
    expect([...keys].sort()).toEqual(
      ["Effective Date", "Governing Law", "Jurisdiction", "MNDA Term", "Purpose", "Term of Confidentiality"].sort(),
    );
    const out = buildStandardTerms(standardTerms, completeForm(), "html");
    expect(out).not.toContain("coverpage_link");
  });

  it("the cover page template headings all appear in the generated cover page", () => {
    const template = fs.readFileSync(path.join(templatesDir, "Mutual-NDA-coverpage.md"), "utf8");
    const headings = [...template.matchAll(/^###? (.+)$/gm)].map((m) => m[1].trim());
    const generated = buildCoverPage(completeForm(), "md");
    for (const h of headings) expect(generated).toContain(h);
  });
});

describe("buildDocument", () => {
  it("joins the cover page and standard terms with a rule", () => {
    const doc = buildDocument(standardTerms, completeForm(), "md");
    const [cover, terms] = doc.split("\n\n---\n\n");
    expect(cover).toContain("# Mutual Non-Disclosure Agreement");
    expect(terms.startsWith("# Standard Terms")).toBe(true);
  });

  it("md output has no HTML tags or entities for a typical form", () => {
    const doc = buildDocument(standardTerms, completeForm(), "md");
    expect(doc).not.toMatch(/<\/?(span|br|label|small)/);
    expect(doc).not.toMatch(/&(nbsp|amp|lt|gt|quot|#\d+);/);
  });

  it("is deterministic for the same input", () => {
    const f = completeForm();
    expect(buildDocument(standardTerms, f, "html")).toBe(buildDocument(standardTerms, f, "html"));
  });

  it("html mode defaults when mode is omitted", () => {
    const f = completeForm();
    expect(buildDocument(standardTerms, f)).toBe(buildDocument(standardTerms, f, "html"));
  });

  it("handles very long input without throwing", () => {
    const long = "x".repeat(50_000);
    expect(() => buildDocument(standardTerms, completeForm({ purpose: long, modifications: long }), "md")).not.toThrow();
  });

  it("handles unicode and emoji", () => {
    const doc = buildDocument(standardTerms, completeForm({ governingLaw: "Zürich 🇨🇭 日本" }), "md");
    expect(doc).toContain("Zürich 🇨🇭 日本");
  });
});
