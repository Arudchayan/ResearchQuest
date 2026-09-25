import { expect, test } from "@playwright/test";
import { seededTopicDetailHeading } from "./a11y";

const lessonUrl = "https://learning-platform-chi-ten.vercel.app/learn/bioinformatics-algorithms-lab/sequence-to-alignment/";
const prompt = "Compare two DNA sequences and explain what a gap represents.";
const handoff = `/tasks?source=learning-platform&subject=Biology&lesson=Cells&title=Review%20cells&lessonUrl=${encodeURIComponent(lessonUrl)}&prompt=${encodeURIComponent(prompt)}`;

test("a demo visitor reaches an editable lesson task draft", async ({ page }) => {
  await page.goto(handoff);
  const demoEntry = page.locator("[data-rq-demo-entry]").first();
  await expect(demoEntry).toBeVisible();
  await expect(demoEntry).toHaveAttribute("href", handoff);
  await demoEntry.click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: "New Task" })).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Review cells");
  await expect(page.getByLabel("Description (Optional)")).toHaveValue(/Subject: Biology/);
  await expect(page.getByLabel("Description (Optional)")).toHaveValue(/Suggested investigation: Compare two DNA sequences/);
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue("Study");
  await expect(page.getByRole("link", { name: "Back to lesson" })).toHaveAttribute("href", lessonUrl);
  await expect(page).toHaveURL(/\/tasks$/);

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "New Task" }).first().click();
  await expect(page.getByRole("link", { name: "Back to lesson" })).toHaveCount(0);
});

test("a saved demo task retains the exact Atlas return link", async ({ page }) => {
  await page.goto(handoff);
  await page.locator("[data-rq-demo-entry]").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Title", { exact: true }).fill("Review cells and explain the gap");
  await dialog.locator("form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(dialog).toHaveCount(0);
  const savedTask = page.getByRole("heading", { name: "Review cells and explain the gap" });
  await expect(savedTask).toBeVisible();
  await expect(savedTask).toHaveCount(1);
  const returnLinks = page.getByRole("link", { name: "Return to lesson" });
  await expect(returnLinks).toHaveCount(1);
  await expect(returnLinks).toHaveAttribute("href", lessonUrl);
});

test("a failed save keeps the handoff draft editable", async ({ page }) => {
  await page.goto(handoff);
  await page.locator("[data-rq-demo-entry]").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Description (Optional)").fill("x".repeat(1001));
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("Task was not saved");
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue("Review cells");
  await expect(dialog.getByLabel("Description (Optional)")).toHaveValue("x".repeat(1001));
  await dialog.getByLabel("Description (Optional)").fill("A shorter investigation.");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Review cells", exact: true })).toHaveCount(1);
});

test("the static demo link preserves the handoff before React mounts", async ({ page }) => {
  let firstModule = true;
  await page.route("**/src/main.tsx", (route) => {
    if (firstModule) {
      firstModule = false;
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(handoff, { waitUntil: "domcontentloaded" });
  const staticEntry = page.locator("#rq-static-gate [data-rq-demo-entry]");
  await expect(staticEntry).toHaveAttribute("href", handoff);
  await staticEntry.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Review cells");
  await expect(page.getByRole("link", { name: "Back to lesson" })).toHaveAttribute("href", lessonUrl);
});

test("ordinary demo entry still opens the seeded topic", async ({ page }) => {
  await page.goto("/");
  const demoEntry = page.locator("[data-rq-demo-entry]").first();
  await expect(demoEntry).toHaveAttribute("href", "/topics/topic-ai-agents");
  await demoEntry.click();
  await expect(page).toHaveURL(/\/topics\/topic-ai-agents$/);
  await expect(seededTopicDetailHeading(page)).toBeVisible();
});
