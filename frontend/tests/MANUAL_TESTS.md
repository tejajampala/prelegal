# Manual test plan: Mutual NDA creator

Run the app with `npm install && npm run dev` from `frontend/` and open http://localhost:3000.
The automated suites cover most of this (`npm test` for unit tests; `npm run test:e2e` for browser tests, which build and serve the app itself. Set `PW_CHANNEL=chrome` to use installed Chrome, `PW_DEV=1` to test `next dev`; first run `npx playwright install chromium`); the items below are the
things that need human eyes, a real printer/PDF dialog, assistive technology, or other browsers.

Record the browser, OS, and date next to each run. Mark each case Pass / Fail / N/A.

## 1. First load

| ID | Steps | Expected |
|----|-------|----------|
| M-01 | Open the page. | Form on the left, document preview on the right. Tab title is "Mutual NDA Creator". |
| M-02 | Read the preview top to bottom. | Cover page followed by a rule and the 11 numbered Standard Terms. Common Paper CC BY 4.0 footer lines are present. |
| M-03 | Look at the status line above the buttons. | "9 required fields still to complete before you can download", with the list of fields beneath it. |
| M-04 | Hover and try to click each of the three buttons. | Buttons look dimmed with a "not allowed" cursor. Nothing downloads and no print dialog opens. |

## 2. Live preview

| ID | Steps | Expected |
|----|-------|----------|
| M-10 | Type in Governing law and Jurisdiction. | Cover page and Standard Terms clause 9 update as you type, with the values highlighted yellow in the terms. |
| M-11 | Change Purpose. | New purpose shows on the cover page and highlighted in clauses 1 and 2. |
| M-12 | Pick an effective date with the date picker. | Shown as "Month D, YYYY" in the cover page and clause 5. |
| M-13 | Click "Use today's date". | Field is set to today's date in your local time zone (check around midnight if you can). |
| M-14 | Fill both parties' name, title, company, notice address and date. | Signature table shows them in the right columns; Signature row stays blank. |
| M-15 | Add text under MNDA modifications. | "None." is replaced by your text. |

## 3. Term options

| ID | Steps | Expected |
|----|-------|----------|
| M-20 | Look at the MNDA term and Term of confidentiality sections in the preview. | Each shows both options as checkboxes; the selected one is ticked. |
| M-21 | Switch each radio group in turn. | The ticked box moves in the preview. The number box is greyed out when its option is not selected. |
| M-22 | Change the number of years. | The preview shows the new number. |

## 4. Download gating

| ID | Steps | Expected |
|----|-------|----------|
| M-30 | Fill every required field. | Status changes to "Ready to download.", the list disappears, buttons look active. |
| M-31 | Clear one required field (try Governing law, then a party's date). | Status and list reappear naming exactly that field; buttons look disabled again. |
| M-32 | Set a year box to 0, -1, 1.5, 100 or empty (valid range is 1 to 99). | "MNDA term (whole years)" / "Term of confidentiality (whole years)" is listed and downloads are blocked. |
| M-33 | With an invalid year, select the other radio option (Continues until terminated / In perpetuity). | The invalid year no longer blocks download. |
| M-34 | Enter only spaces in a required field. | Treated as empty. |

## 5. Downloads (use a complete form)

| ID | Steps | Expected |
|----|-------|----------|
| M-40 | Click Download (.md); open the file in a plain text editor and a markdown viewer. | File is `Mutual-NDA.md`. Plain text has no `<span>` tags or `&...;` entities. Checkboxes show as `[x]` / `[ ]`. Table renders in the viewer. Curly quotes display correctly. |
| M-41 | Click Download (.html); open the file in the browser. | File is `Mutual-NDA.html`, opens standalone (no app needed), looks like the preview, filled values are highlighted, checkboxes and table are present. |
| M-42 | Compare the .html text with the on-screen preview. | Identical wording. |
| M-43 | Edit a field and download again. | New file contains the edit. |
| M-44 | Click Print / Save as PDF; choose "Save as PDF". | Print preview shows only the document: no form, no buttons, no status line. Page breaks are acceptable. Yellow highlights print. |
| M-45 | Cancel the print dialog. | Page is unchanged and still usable. |

## 6. Hostile and unusual input

| ID | Steps | Expected |
|----|-------|----------|
| M-50 | Enter `<img src=x onerror=alert(1)>` and `<script>alert(1)</script>` in every text field. | No alert appears. The text is shown literally in the preview and in both downloads. |
| M-51 | Enter `**bold** _italic_ [link](http://example.com)` in Governing law. | Shown literally, not formatted and not a link. |
| M-52 | Enter `A \| B` as a name. | Table row keeps three columns and shows `A \| B`. |
| M-53 | In Modifications enter lines beginning `- `, `1. `, `---`, `===`. | Lines are shown as text, not as a list, numbered list, rule or heading. |
| M-54 | Paste 5,000+ characters in Purpose; enter accented, CJK and emoji text. | Page stays responsive; text round-trips into the downloads. |

## 7. Accessibility

| ID | Steps | Expected |
|----|-------|----------|
| M-60 | Use only the keyboard (Tab, Shift+Tab, Space, arrows, Enter) to complete the form and download. | Every control is reachable, focus is visible, radios work with arrows. |
| M-61 | Tab to a download button while the form is incomplete. | Button is focusable; a screen reader announces it as dimmed/disabled and reads the missing-fields list. |
| M-62 | With NVDA / VoiceOver / TalkBack running, fill in a field that changes the missing count. | The status line is announced politely; the whole list is not re-read on every keystroke. |
| M-63 | Navigate the form with a screen reader. | Each field has a spoken name, including the two year boxes ("MNDA term in years", "Confidentiality term in years"). The "Use today's date" button is announced separately from the date field. |
| M-64 | Zoom to 200% and 400%. | No loss of content or function; no horizontal scrolling at 400%. |
| M-65 | Check text contrast of the orange missing-fields box and the blue links/buttons. | Meets WCAG AA (4.5:1). |
| M-66 | Enable dark mode in the OS. | Form remains readable. The white document preview is acceptable. |

## 8. Layout and browsers

| ID | Steps | Expected |
|----|-------|----------|
| M-70 | Resize from 1400px to 320px wide. | Two columns above 900px, stacked below; no horizontal page scroll. |
| M-71 | Repeat M-10, M-30, M-40, M-41, M-44 in Chrome, Edge, Firefox and Safari. | Same behaviour. Date picker UI differs by browser, which is fine. |
| M-72 | Repeat M-10, M-30, M-40 on a phone (iOS Safari, Android Chrome). | Usable; downloads are saved or offered by the OS. |
| M-73 | Change OS time zone to Pacific/Auckland, then Pacific/Honolulu, and use "Use today's date" close to local midnight. | Date matches the local calendar date, not the UTC date. |

## 9. Legal content check (needs a person)

| ID | Steps | Expected |
|----|-------|----------|
| M-80 | Compare the generated cover page with `templates/Mutual-NDA-coverpage.md`. | Same headings, wording and options. Known difference: hint text is italic instead of `<label>` markup and the Notice Address hint is lower-case. |
| M-81 | Compare the Standard Terms with `templates/Mutual-NDA.md`. | Identical apart from the filled-in values. |
| M-82 | Read clause 5 with "Continues until terminated" selected. | Reads "expires at the end of the period until terminated". This wording is awkward; decide whether it needs rewording before real use. |

## Known limitations

- The cover page is generated in code, not read from `templates/Mutual-NDA-coverpage.md`; edits to that template will not appear in the app.
- Pressing Ctrl+P prints the page even when downloads are blocked.
- The app is a prototype and is not legal advice.
