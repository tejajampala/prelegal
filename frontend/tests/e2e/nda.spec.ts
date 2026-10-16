import { expect, test, type Page } from "@playwright/test";
import {
  DOWNLOAD_BUTTONS,
  button,
  expectDownloadsDisabled,
  expectDownloadsEnabled,
  fillRequired,
  open,
  party,
  readDownload,
} from "./helpers";

type PrintCounter = { __prints: number; __pwned?: number };

test.beforeEach(async ({ page }) => {
  await open(page);
});

const preview = (page: Page) => page.locator("article");

async function stubPrint(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as PrintCounter;
    w.__prints = 0;
    window.print = () => {
      w.__prints += 1;
    };
  });
}

const printCount = (page: Page) => page.evaluate(() => (window as unknown as PrintCounter).__prints);

test.describe("initial state", () => {
  test("renders the form and the live preview", async ({ page }) => {
    await expect(page).toHaveTitle("Mutual NDA Creator");
    await expect(page.getByRole("heading", { name: "Mutual NDA Creator", level: 1 })).toBeVisible();
    await expect(preview(page).getByRole("heading", { name: "Mutual Non-Disclosure Agreement", level: 1 })).toBeVisible();
    await expect(preview(page).getByRole("heading", { name: "Standard Terms" })).toBeVisible();
    await expect(preview(page)).toContainText("Evaluating whether to enter into a business relationship");
  });

  test("shows the full standard terms (11 numbered sections)", async ({ page }) => {
    await expect(preview(page).locator("ol > li")).toHaveCount(11);
  });

  test("downloads are disabled and the missing fields are listed", async ({ page }) => {
    await expectDownloadsDisabled(page);
    await expect(page.getByRole("status")).toContainText("9 required fields still to complete");
    await expect(page.locator("#missing-fields li")).toHaveText([
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

  test("blank values show underscore placeholders in the preview", async ({ page }) => {
    await expect(preview(page)).toContainText("Governing Law: ________");
  });
});

test.describe("live preview", () => {
  test("typed values appear in the cover page and the standard terms", async ({ page }) => {
    await page.getByLabel("Governing law (state)").fill("Delaware");
    await page.getByLabel("Jurisdiction (city/county and state)").fill("New Castle, DE");
    await expect(preview(page)).toContainText("Governing Law: Delaware");
    await expect(preview(page)).toContainText("Jurisdiction: New Castle, DE");
    await expect(preview(page).locator("span.filled", { hasText: "Delaware" }).first()).toBeVisible();
    await expect(preview(page)).toContainText("laws of the State of Delaware");
  });

  test("purpose changes flow into the standard terms", async ({ page }) => {
    await page.getByLabel("Purpose").fill("Exploring a merger");
    await expect(preview(page).locator("span.filled", { hasText: "Exploring a merger" }).first()).toBeVisible();
    await expect(preview(page)).not.toContainText("Evaluating whether to enter");
  });

  test("effective date is formatted long-form", async ({ page }) => {
    await page.getByLabel("Effective date").fill("2026-10-17");
    await expect(preview(page)).toContainText("October 17, 2026");
  });

  test("party details fill the signature table", async ({ page }) => {
    await fillRequired(page);
    await party(page, 1).getByLabel("Title").fill("CEO");
    await party(page, 2).getByLabel("Notice address (email or postal)").fill("bob@globex.test");
    const table = preview(page).locator("table");
    await expect(table.locator("tr", { hasText: "Print Name" })).toContainText("Alice Example");
    await expect(table.locator("tr", { hasText: "Print Name" })).toContainText("Bob Sample");
    await expect(table.locator("tr", { hasText: "Title" })).toContainText("CEO");
    await expect(table.locator("tr", { hasText: "Notice Address" })).toContainText("bob@globex.test");
    await expect(table.locator("tr", { hasText: "Company" })).toContainText("Globex LLC");
    await expect(table.locator("tr", { hasText: "Date" })).toContainText("October 18, 2026");
  });

  test("modifications replace 'None.'", async ({ page }) => {
    await expect(preview(page)).toContainText("None.");
    await page.getByLabel("MNDA modifications (optional)").fill("The term is extended by six months.");
    await expect(preview(page)).toContainText("The term is extended by six months.");
  });

  test("hint text and notice-address hint are shown", async ({ page }) => {
    await expect(preview(page)).toContainText("How Confidential Information may be used");
    await expect(preview(page)).toContainText("use either email or postal address");
  });
});

test.describe("term options (checkboxes)", () => {
  const boxes = (page: Page) => preview(page).locator('input[type="checkbox"]');

  test("renders four checkboxes with the defaults checked", async ({ page }) => {
    await expect(boxes(page)).toHaveCount(4);
    await expect(boxes(page).nth(0)).toBeChecked();
    await expect(boxes(page).nth(1)).not.toBeChecked();
    await expect(boxes(page).nth(2)).toBeChecked();
    await expect(boxes(page).nth(3)).not.toBeChecked();
  });

  test("switching the MNDA term radio flips the first pair", async ({ page }) => {
    await page.getByRole("radio", { name: /Continues until terminated/ }).check();
    await expect(boxes(page).nth(0)).not.toBeChecked();
    await expect(boxes(page).nth(1)).toBeChecked();
    await expect(preview(page)).toContainText("expires at the end of the period until terminated");
  });

  test("switching confidentiality to perpetuity flips the second pair", async ({ page }) => {
    await page.getByRole("radio", { name: /In perpetuity/ }).check();
    await expect(boxes(page).nth(2)).not.toBeChecked();
    await expect(boxes(page).nth(3)).toBeChecked();
    await expect(preview(page)).toContainText("will survive for the perpetuity");
  });

  test("year inputs are enabled only for their selected option", async ({ page }) => {
    const term = page.getByRole("group", { name: "MNDA term" }).getByRole("spinbutton");
    await expect(term).toBeEnabled();
    await page.getByRole("radio", { name: /Continues until terminated/ }).check();
    await expect(term).toBeDisabled();
    await page.getByRole("radio", { name: /Expires after/ }).check();
    await expect(term).toBeEnabled();
  });

  test("each option pair is one radio group, so arrow keys move between options", async ({ page }) => {
    const expires = page.getByRole("radio", { name: /Expires after/ });
    const untilTerminated = page.getByRole("radio", { name: /Continues until terminated/ });
    // Chromium moves between nameless radios too, so also assert the group names that other browsers rely on.
    await expect(expires).toHaveAttribute("name", "termType");
    await expect(untilTerminated).toHaveAttribute("name", "termType");
    await expect(page.getByRole("radio", { name: /For\s/ })).toHaveAttribute("name", "confidentialityType");
    await expect(page.getByRole("radio", { name: /In perpetuity/ })).toHaveAttribute("name", "confidentialityType");
    await expires.focus();
    await page.keyboard.press("ArrowDown");
    await expect(untilTerminated).toBeChecked();
    await expect(expires).not.toBeChecked();
    await page.keyboard.press("ArrowUp");
    await expect(expires).toBeChecked();

    const years = page.getByRole("radio", { name: /For\s/ });
    const perpetuity = page.getByRole("radio", { name: /In perpetuity/ });
    await years.focus();
    await page.keyboard.press("ArrowDown");
    await expect(perpetuity).toBeChecked();
    await expect(years).not.toBeChecked();
  });

  test("changing years updates the preview", async ({ page }) => {
    await page.getByRole("group", { name: "MNDA term" }).getByRole("spinbutton").fill("3");
    await page.getByRole("group", { name: "Term of confidentiality" }).getByRole("spinbutton").fill("5");
    await expect(preview(page)).toContainText("Expires 3 year(s) from Effective Date.");
    await expect(preview(page)).toContainText("5 year(s) from Effective Date, but in the case of trade secrets");
  });
});

test.describe("validation gating", () => {
  test("filling all required fields enables downloads and clears the list", async ({ page }) => {
    await fillRequired(page);
    await expect(page.getByRole("status")).toHaveText("Ready to download.");
    await expect(page.locator("#missing-fields")).toHaveCount(0);
    await expectDownloadsEnabled(page);
  });

  test("the missing count updates as fields are filled", async ({ page }) => {
    await page.getByLabel("Governing law (state)").fill("Delaware");
    await expect(page.getByRole("status")).toContainText("8 required fields");
    await page.getByLabel("Jurisdiction (city/county and state)").fill("NY");
    await expect(page.getByRole("status")).toContainText("7 required fields");
  });

  test("uses the singular when one field remains", async ({ page }) => {
    await fillRequired(page);
    await party(page, 2).getByLabel("Date").fill("");
    await expect(page.getByRole("status")).toContainText("1 required field still to complete");
    await expect(page.locator("#missing-fields li")).toHaveText(["Party 2 date"]);
  });

  test("clearing a required field disables downloads again", async ({ page }) => {
    await fillRequired(page);
    await expectDownloadsEnabled(page);
    await page.getByLabel("Governing law (state)").fill("");
    await expectDownloadsDisabled(page);
  });

  test("clearing the purpose is flagged", async ({ page }) => {
    await fillRequired(page);
    await page.getByLabel("Purpose").fill("");
    await expect(page.locator("#missing-fields li")).toHaveText(["Purpose"]);
  });

  test("whitespace-only values do not count", async ({ page }) => {
    await fillRequired(page);
    await page.getByLabel("Governing law (state)").fill("   ");
    await expect(page.locator("#missing-fields li")).toHaveText(["Governing law"]);
  });

  for (const bad of ["", "0", "-2", "1.5", "100", "1e3"]) {
    test(`an invalid MNDA term of ${JSON.stringify(bad)} years blocks download`, async ({ page }) => {
      await fillRequired(page);
      await page.getByRole("group", { name: "MNDA term" }).getByRole("spinbutton").fill(bad);
      await expect(page.locator("#missing-fields li")).toHaveText(["MNDA term (whole years)"]);
      await expectDownloadsDisabled(page);
    });
  }

  test("an invalid year is ignored once its option is deselected", async ({ page }) => {
    await fillRequired(page);
    await page.getByRole("group", { name: "Term of confidentiality" }).getByRole("spinbutton").fill("0");
    await expectDownloadsDisabled(page);
    await page.getByRole("radio", { name: /In perpetuity/ }).check();
    await expectDownloadsEnabled(page);
  });

  test("clicking a disabled download button does nothing", async ({ page }) => {
    let downloads = 0;
    page.on("download", () => downloads++);
    await stubPrint(page);
    // force: Playwright treats aria-disabled buttons as non-actionable, but real users can still click them
    for (const name of DOWNLOAD_BUTTONS) await button(page, name).click({ force: true });
    await page.waitForTimeout(500);
    expect(downloads).toBe(0);
    expect(await printCount(page)).toBe(0);
  });

  test("the preview still updates while downloads are blocked", async ({ page }) => {
    await page.getByLabel("Governing law (state)").fill("Texas");
    await expectDownloadsDisabled(page);
    await expect(preview(page)).toContainText("Governing Law: Texas");
  });
});

test.describe("downloads", () => {
  test.beforeEach(async ({ page }) => {
    await fillRequired(page);
    await page.getByLabel("MNDA modifications (optional)").fill("Extra clause.");
  });

  test("markdown download is clean, complete and named correctly", async ({ page }) => {
    const { filename, text } = await readDownload(page, "Download (.md)");
    expect(filename).toBe("Mutual-NDA.md");
    expect(text).toContain("# Mutual Non-Disclosure Agreement");
    expect(text).toContain("Governing Law: Delaware");
    expect(text).toContain("| Print Name | Alice Example | Bob Sample |");
    expect(text).toContain("- [x] Expires 1 year(s) from Effective Date.");
    expect(text).toContain("- [ ] In perpetuity.");
    expect(text).toContain("Extra clause.");
    expect(text).toContain("# Standard Terms");
    expect(text).toContain("laws of the State of Delaware");
    expect(text).not.toContain("<span");
    expect(text).not.toMatch(/&(nbsp|amp|lt|gt|quot|#\d+);/);
    expect(text).not.toContain("coverpage_link");
  });

  test("html download is a standalone, utf-8 document with the same content", async ({ page }) => {
    const { filename, text } = await readDownload(page, "Download (.html)");
    expect(filename).toBe("Mutual-NDA.html");
    expect(text.startsWith("<!doctype html>")).toBe(true);
    expect(text).toContain('<meta charset="utf-8">');
    expect(text).toContain("<title>Mutual NDA</title>");
    expect(text).toContain("Alice Example");
    expect(text).toContain("Globex LLC");
    expect(text).toContain("Standard Terms");
    expect(text).toContain('class="filled"');
    expect(text).not.toContain("coverpage_link");
  });

  test("the html download renders the same text as the on-screen preview", async ({ page, context }) => {
    const { text } = await readDownload(page, "Download (.html)");
    const other = await context.newPage();
    await other.setContent(text);
    const normalise = (s: string) => s.replace(/\s+/g, " ").trim();
    const onScreen = normalise(await preview(page).innerText());
    const downloaded = normalise(await other.locator("body").innerText());
    expect(downloaded).toBe(onScreen);
  });

  test("the downloaded html shows checkboxes and a signature table", async ({ page, context }) => {
    const { text } = await readDownload(page, "Download (.html)");
    const other = await context.newPage();
    await other.setContent(text);
    await expect(other.locator('input[type="checkbox"]')).toHaveCount(4);
    await expect(other.locator("table tr")).toHaveCount(7);
  });

  test("downloads reflect edits made after the first download", async ({ page }) => {
    const first = await readDownload(page, "Download (.md)");
    expect(first.text).toContain("Governing Law: Delaware");
    await page.getByLabel("Governing law (state)").fill("Nevada");
    const second = await readDownload(page, "Download (.md)");
    expect(second.text).toContain("Governing Law: Nevada");
    expect(second.text).not.toContain("Governing Law: Delaware");
  });

  test("markdown reflects the selected options", async ({ page }) => {
    await page.getByRole("radio", { name: /Continues until terminated/ }).check();
    await page.getByRole("radio", { name: /In perpetuity/ }).check();
    const { text } = await readDownload(page, "Download (.md)");
    expect(text).toContain("- [ ] Expires");
    expect(text).toContain("- [x] Continues until terminated");
    expect(text).toContain("- [x] In perpetuity.");
  });

  test("print calls window.print once when ready", async ({ page }) => {
    await stubPrint(page);
    await button(page, "Print / Save as PDF").click();
    expect(await printCount(page)).toBe(1);
  });
});

test.describe("security / hostile input", () => {
  const xss = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
  const pwned = (page: Page) => page.evaluate(() => (window as unknown as PrintCounter).__pwned);

  test("script and image payloads in every free-text field are inert in the preview", async ({ page }) => {
    await fillRequired(page);
    await page.getByLabel("Purpose").fill(xss);
    await page.getByLabel("Governing law (state)").fill(xss);
    await page.getByLabel("Jurisdiction (city/county and state)").fill(xss);
    await page.getByLabel("MNDA modifications (optional)").fill(xss);
    await party(page, 1).getByLabel("Print name").fill(xss);
    await party(page, 1).getByLabel("Title").fill(xss);
    await party(page, 1).getByLabel("Company").fill(xss);
    await party(page, 1).getByLabel("Notice address (email or postal)").fill(xss);
    await page.waitForTimeout(300);
    expect(await pwned(page)).toBeUndefined();
    await expect(preview(page).locator("img")).toHaveCount(0);
    await expect(preview(page).locator("script")).toHaveCount(0);
    await expect(preview(page)).toContainText('<img src=x onerror="window.__pwned=1">');
  });

  test("the downloaded html does not execute payloads either", async ({ page, context }) => {
    await fillRequired(page);
    await party(page, 1).getByLabel("Print name").fill(xss);
    const { text } = await readDownload(page, "Download (.html)");
    expect(text).not.toContain("<img src=x");
    expect(text).not.toContain("<script>window");
    const other = await context.newPage();
    await other.setContent(text);
    await other.waitForTimeout(300);
    expect(await pwned(other)).toBeUndefined();
  });

  test("markdown syntax in user text is shown literally", async ({ page }) => {
    await fillRequired(page);
    await page.getByLabel("Governing law (state)").fill("**bold** _it_ [link](http://evil.test)");
    await expect(preview(page).locator("strong", { hasText: "bold" })).toHaveCount(0);
    await expect(preview(page).getByRole("link", { name: "link", exact: true })).toHaveCount(0);
    await expect(preview(page)).toContainText("Governing Law: **bold** _it_ [link](http://evil.test)");
  });

  test("a pipe in a name does not break the signature table", async ({ page }) => {
    await fillRequired(page);
    await party(page, 1).getByLabel("Print name").fill("A | B");
    const row = preview(page).locator("table tr", { hasText: "Print Name" });
    await expect(row.locator("td")).toHaveCount(3);
    await expect(row).toContainText("A | B");
  });

  test("list markers at the start of a modification line are not turned into a list", async ({ page }) => {
    await page.getByLabel("MNDA modifications (optional)").fill("- not a bullet\n1. not numbered");
    await expect(preview(page)).toContainText("- not a bullet");
    await expect(preview(page)).toContainText("1. not numbered");
    await expect(preview(page).locator("ul > li:not(:has(input))")).toHaveCount(0);
  });

  test("unicode and very long values do not break the page", async ({ page }) => {
    await fillRequired(page);
    await page.getByLabel("Governing law (state)").fill("Zürich 日本 🇨🇭");
    await page.getByLabel("Purpose").fill("x".repeat(5000));
    await expect(preview(page)).toContainText("Zürich 日本 🇨🇭");
    await expectDownloadsEnabled(page);
    const { text } = await readDownload(page, "Download (.md)");
    expect(text).toContain("Zürich 日本 🇨🇭");
  });
});

test.describe("use today's date", () => {
  const todayButton = (page: Page) => page.getByRole("button", { name: /Use today/ });

  test("fills the effective date with the browser's local date", async ({ page }) => {
    const expected = await page.evaluate(() => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    });
    await todayButton(page).click();
    await expect(page.getByLabel("Effective date")).toHaveValue(expected);
  });

  test("uses the local date in a far-east timezone near midnight", async ({ browser }) => {
    const context = await browser.newContext({ timezoneId: "Pacific/Auckland" });
    const page = await context.newPage();
    await page.clock.install({ time: new Date("2026-06-30T12:30:00Z") }); // 00:30 on 1 July in Auckland
    await open(page);
    await todayButton(page).click();
    await expect(page.getByLabel("Effective date")).toHaveValue("2026-07-01");
    await context.close();
  });

  test("uses the local date in a far-west timezone near midnight", async ({ browser }) => {
    const context = await browser.newContext({ timezoneId: "Pacific/Honolulu" });
    const page = await context.newPage();
    await page.clock.install({ time: new Date("2026-07-01T09:30:00Z") }); // 23:30 on 30 June in Honolulu
    await open(page);
    await todayButton(page).click();
    await expect(page.getByLabel("Effective date")).toHaveValue("2026-06-30");
    await context.close();
  });

  test("the button is not part of the date field's accessible name", async ({ page }) => {
    await expect(page.getByLabel("Effective date")).toHaveCount(1);
    await expect(page.getByLabel(/Effective date.*Use today/)).toHaveCount(0);
  });
});

test.describe("accessibility", () => {
  test("the status region is present from the start and stays a single element", async ({ page }) => {
    await expect(page.getByRole("status")).toHaveCount(1);
    await fillRequired(page);
    await expect(page.getByRole("status")).toHaveCount(1);
  });

  test("disabled-looking buttons stay focusable and point at the missing list", async ({ page }) => {
    for (const name of DOWNLOAD_BUTTONS) {
      const b = button(page, name);
      await b.focus();
      await expect(b).toBeFocused();
      await expect(b).toHaveAttribute("aria-describedby", "missing-fields");
    }
    await expect(page.locator("#missing-fields")).toBeVisible();
  });

  test("aria-describedby is removed once the form is complete", async ({ page }) => {
    await fillRequired(page);
    for (const name of DOWNLOAD_BUTTONS) {
      await expect(button(page, name)).not.toHaveAttribute("aria-describedby", /.+/);
    }
  });

  test("every form control has an accessible name", async ({ page }) => {
    const controls = page.locator("form input, form textarea");
    const count = await controls.count();
    expect(count).toBeGreaterThan(15);
    for (let i = 0; i < count; i++) {
      const name = await controls.nth(i).evaluate((el) => {
        const e = el as HTMLInputElement;
        return (e.labels && e.labels[0]?.textContent?.trim()) || e.getAttribute("aria-label") || "";
      });
      expect(name, `control #${i} has no label`).not.toBe("");
    }
  });

  test("the date helper is reachable and usable by keyboard", async ({ page }) => {
    await page.getByLabel("Effective date").focus();
    await page.keyboard.press("Tab");
    // date inputs have internal segments, so tab until the helper button is focused
    const helper = page.getByRole("button", { name: /Use today/ });
    for (let i = 0; i < 6 && !(await helper.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(helper).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Effective date")).not.toHaveValue("");
  });

  test("pressing Enter in a field does not submit or reload the page", async ({ page }) => {
    const input = page.getByLabel("Governing law (state)");
    await input.fill("Ohio");
    await input.press("Enter");
    await expect(input).toHaveValue("Ohio");
    expect(page.url()).toMatch(/\/$/);
  });
});

test.describe("layout", () => {
  test("print media hides the form and controls and shows the document", async ({ page }) => {
    await fillRequired(page);
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("form")).toBeHidden();
    for (const name of DOWNLOAD_BUTTONS) await expect(button(page, name)).toBeHidden();
    await expect(page.getByRole("status")).toBeHidden();
    await expect(preview(page)).toBeVisible();
  });

  test("print media also hides the missing-fields list when incomplete", async ({ page }) => {
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("#missing-fields")).toBeHidden();
    await expect(page.getByRole("status")).toBeHidden();
  });

  test("desktop uses two columns", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const form = await page.locator("form").boundingBox();
    const art = await preview(page).boundingBox();
    expect(form!.x + form!.width).toBeLessThanOrEqual(art!.x);
  });

  test("mobile stacks the columns and does not scroll horizontally", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await fillRequired(page);
    const form = await page.locator("form").boundingBox();
    const art = await preview(page).boundingBox();
    expect(art!.y).toBeGreaterThanOrEqual(form!.y + form!.height - 1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("disabled buttons look disabled and enabled ones do not", async ({ page }) => {
    const opacity = () => button(page, "Download (.md)").evaluate((el) => Number(getComputedStyle(el).opacity));
    expect(await opacity()).toBeLessThan(1);
    await fillRequired(page);
    expect(await opacity()).toBe(1);
  });
});

test.describe("robustness", () => {
  test("no console errors or failed requests while using the app", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
    page.on("pageerror", (e) => problems.push(e.message));
    page.on("requestfailed", (r) => problems.push(`${r.method()} ${r.url()}`));
    await open(page);
    await fillRequired(page);
    await page.getByRole("radio", { name: /In perpetuity/ }).check();
    await readDownload(page, "Download (.md)");
    expect(problems).toEqual([]);
  });

  test("reloading resets the form to its defaults", async ({ page }) => {
    await page.getByLabel("Governing law (state)").fill("Ohio");
    await page.reload();
    await expect(page.getByLabel("Governing law (state)")).toHaveValue("");
    await expectDownloadsDisabled(page);
  });

  test("rapid typing keeps the preview in sync with the final value", async ({ page }) => {
    await page.getByLabel("Governing law (state)").pressSequentially("Massachusetts", { delay: 5 });
    await expect(preview(page)).toContainText("Governing Law: Massachusetts");
  });
});
