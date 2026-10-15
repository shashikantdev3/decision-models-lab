import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = [
  { path: "#/", heading: /quick calls/ },
  { path: "#/hello", heading: "Hello World" },
  { path: "#/learn", heading: "How decision models work" },
  { path: "#/playground", heading: "Playground" },
  { path: "#/desk", heading: "Contoso Triage Desk" },
  { path: "#/results", heading: "Results" },
  { path: "#/extend", heading: "Extend the lab" },
];

for (const p of pages) {
  test(`${p.path} loads with no errors and no serious accessibility issues`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && !/fonts\.g/.test(m.text()) && errors.push(m.text()));
    await page.goto(p.path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(p.heading);
    await page.waitForTimeout(1500);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(
      serious.map(
        (v) =>
          `${v.id}: ${v.nodes
            .map((n) => n.target.join(" "))
            .slice(0, 3)
            .join(", ")}`,
      ),
    ).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("the threshold slider re-routes the queue", async ({ page }) => {
  await page.goto("#/desk");
  const auto = page
    .locator("dt", { hasText: "Handled automatically" })
    .locator("xpath=following-sibling::dd");
  await expect(auto).toHaveText(/%/);
  const before = await auto.textContent();
  await page.locator("#th").fill("0.99");
  await expect(auto).not.toHaveText(before!);
  await page.locator("[data-flip]").first().click();
  await expect(page.locator("#detail-title")).toBeVisible();
});

test("the playground runs in mock mode", async ({ page }) => {
  await page.goto("#/playground");
  await page.getByRole("button", { name: "Mock" }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("Raw JSON")).toBeVisible();
});

test("hello world shows the recorded answer without a key", async ({ page }) => {
  await page.goto("#/hello");
  await page.getByRole("button", { name: "Show the recorded answer" }).click();
  await expect(page.getByText(/^Recorded answer, /)).toBeVisible();
  await page.getByRole("tab", { name: "Windows PowerShell" }).click();
  await expect(page.getByText("Copy-Item .env.example .env")).toBeVisible();
});

test("keys are never written to storage", async ({ page }) => {
  await page.goto("#/");
  await page.getByRole("button", { name: "Live" }).click();
  await page.locator("#key-or").fill("sk-or-test-not-a-real-key");
  const stored = await page.evaluate(
    () => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
  );
  expect(stored).not.toContain("sk-or-test");
});
