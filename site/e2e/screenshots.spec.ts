/** Screenshots of every page at 1440px and 390px in both themes, saved to docs/screenshots/. */
import { test } from "@playwright/test";

const pages = ["home", "learn", "playground", "desk", "results", "extend"];
for (const name of pages) {
  for (const width of [1440, 390]) {
    for (const theme of ["light", "dark"] as const) {
      test(`${name} ${width} ${theme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(name === "home" ? "#/" : `#/${name}`);
        await page.waitForTimeout(name === "home" ? 7000 : 2500);
        await page.screenshot({
          path: `docs/screenshots/${name}-${width}-${theme}.png`,
          fullPage: true,
          animations: "disabled",
        });
      });
    }
  }
}
