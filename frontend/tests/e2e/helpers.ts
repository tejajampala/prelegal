import { expect, type Locator, type Page } from "@playwright/test";

export const DOWNLOAD_BUTTONS = ["Download (.html)", "Download (.md)", "Print / Save as PDF"] as const;

export const party = (page: Page, n: 1 | 2): Locator => page.getByRole("group", { name: `Party ${n}` });

/** Fills every required field with valid values. */
export async function fillRequired(page: Page) {
  await page.getByLabel("Effective date").fill("2026-10-17");
  await page.getByLabel("Governing law (state)").fill("Delaware");
  await page.getByLabel("Jurisdiction (city/county and state)").fill("New Castle, DE");
  for (const [n, name, company] of [
    [1, "Alice Example", "Acme Inc"],
    [2, "Bob Sample", "Globex LLC"],
  ] as const) {
    await party(page, n).getByLabel("Print name").fill(name);
    await party(page, n).getByLabel("Company").fill(company);
    await party(page, n).getByLabel("Date").fill("2026-10-18");
  }
}

export const button = (page: Page, name: (typeof DOWNLOAD_BUTTONS)[number]) =>
  page.getByRole("button", { name });

export async function expectDownloadsDisabled(page: Page) {
  for (const name of DOWNLOAD_BUTTONS) {
    await expect(button(page, name)).toHaveAttribute("aria-disabled", "true");
  }
}

export async function expectDownloadsEnabled(page: Page) {
  for (const name of DOWNLOAD_BUTTONS) {
    await expect(button(page, name)).toHaveAttribute("aria-disabled", "false");
  }
}

export async function readDownload(page: Page, name: "Download (.html)" | "Download (.md)") {
  const [download] = await Promise.all([page.waitForEvent("download"), button(page, name).click()]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return { filename: download.suggestedFilename(), text: Buffer.concat(chunks).toString("utf8") };
}

/** Opens the app and waits for React to hydrate, so values typed by tests are not reset by hydration. */
export async function open(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => {
    const el = document.querySelector("input");
    return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
  });
}
