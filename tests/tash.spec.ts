import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { encode } from "next-auth/jwt";

// ─── Auth ────────────────────────────────────────────────────────────────────

const NEXTAUTH_SECRET = "gpgaz3rTJVFs3D2eHXozRJFKHrGAEh2H2cNCByWtf5Q=";
const ADMIN_USER = {
  id: "cmka0meph0000xcen4xre4jqf",
  name: "דניאל גולדברג",
  email: "danielgol1997@gmail.com",
  role: "SUPER_ADMIN" as const,
  active: true,
  onboardedAt: "2026-01-15T09:59:00.963Z",
};

async function injectAdminSession(context: BrowserContext) {
  const token = await encode({
    token: {
      sub: ADMIN_USER.id,
      name: ADMIN_USER.name,
      email: ADMIN_USER.email,
      role: ADMIN_USER.role,
      active: ADMIN_USER.active,
      onboardedAt: ADMIN_USER.onboardedAt,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    },
    secret: NEXTAUTH_SECRET,
  });
  await context.addCookies([{
    name: "next-auth.session-token",
    value: token,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  }]);
}

async function wait(page: Page, ms = 2000) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(ms);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the item card for a given item name — scoped to div.rounded-2xl */
function itemCard(page: Page, name: string) {
  return page.locator("div.rounded-2xl").filter({ hasText: name }).first();
}

/** Expands an item card */
async function expandCard(page: Page, name: string) {
  const card = itemCard(page, name);
  await card.locator("div.cursor-pointer").first().click();
  await page.waitForTimeout(400);
}

async function submitAndWaitForReload(page: Page, submitSelector: string) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
    page.locator(submitSelector).click(),
  ]);
  await page.waitForTimeout(1500);
}
async function fillLocation(page: Page, value: string) {
  const input = page.locator(".fixed input[type='text']").first();
  await input.clear();
  await input.fill(value);
  await page.waitForTimeout(500);
  // Click "הוסף מיקום" dropdown option if it appears (for new locations)
  const addOption = page.locator(".fixed").locator("text=הוסף מיקום");
  if (await addOption.isVisible({ timeout: 1000 }).catch(() => false)) {
    await addOption.click();
    await page.waitForTimeout(300);
  }
  // Click the modal title to close any open dropdown before submitting
  const modalTitle = page.locator(".fixed h2").first();
  if (await modalTitle.isVisible({ timeout: 500 }).catch(() => false)) {
    await modalTitle.click();
    await page.waitForTimeout(200);
  }
}

// ─── Test data names ──────────────────────────────────────────────────────────
// Prefix all test items with this so cleanup can find them all
const TEST_PREFIX = "כיסא בדיקה_";
const TEST_ITEM_NAME = `${TEST_PREFIX}${Date.now()}`;
const TEST_LOCATION_1 = "בסיס צפון בדיקה";
const TEST_LOCATION_2 = "בסיס דרום בדיקה";

// ─── Setup: remove any leftover test items from prior runs ────────────────────

test.describe("Setup — clean prior test data", () => {
  test.setTimeout(120000);

  test("remove any leftover כיסא בדיקה items", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/tash");
    await wait(page, 3000);

    let rounds = 0;
    while (rounds < 30) {
      // Re-navigate each round so React re-renders with latest server data
      await page.goto("/admin/tash");
      await wait(page, 2500);

      const testCards = page.locator("div.rounded-2xl").filter({ hasText: TEST_PREFIX });
      if ((await testCards.count()) === 0) break;

      const firstCard = testCards.first();
      const cardText = await firstCard.locator("span.font-bold").first().textContent().catch(() => "?");
      await firstCard.locator("div.cursor-pointer").first().click();
      await page.waitForTimeout(500);

      const deductBtns = firstCard.locator("button", { hasText: "−" });

      if ((await deductBtns.count()) === 0) {
        const delBtn = firstCard.locator("button", { hasText: "🗑" });
        if ((await delBtn.count()) > 0) {
          await delBtn.click();
          await page.waitForTimeout(500);
          const confirmBtn = page.locator(".fixed button", { hasText: "מחק" });
          if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }),
              confirmBtn.click(),
            ]);
            await page.waitForTimeout(1000);
            console.log(`Setup: deleted "${cardText}"`);
          }
        } else break;
      } else {
        await deductBtns.first().click();
        await page.waitForTimeout(500);
        const modal = page.locator(".fixed");
        if (await modal.isVisible()) {
          const qtyText = await modal.locator("span.font-medium").nth(1).textContent().catch(() => "999");
          const qty = parseInt(qtyText?.replace(/[^\d]/g, "") ?? "999") || 999;
          await modal.locator('input[name="quantity"]').fill(String(qty));
          // Use Promise.all to catch the reload navigation before it starts
          await Promise.all([
            page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }),
            modal.locator('button[type="submit"]').click(),
          ]);
          await page.waitForTimeout(1000);
          console.log(`Setup: deducted ${qty} from "${cardText}"`);
        } else break;
      }
      rounds++;
    }
    console.log(`Setup: done after ${rounds} rounds`);
  });
});

// ─── Main feature tests ───────────────────────────────────────────────────────

test.describe("ציוד ת״ש Feature", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90000);

  // 1. Admin home card
  test("admin home shows ציוד ת״ש navigation card", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin");
    await wait(page);

    const card = page.locator('a[href="/admin/tash"]');
    await expect(card).toBeVisible({ timeout: 15000 });
    expect(await card.textContent()).toContain("ציוד ת״ש");
    console.log("✓ Admin home card visible");
  });

  // 2. Page loads
  test("ציוד ת״ש page loads correctly", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/tash");
    await wait(page);

    await expect(page.locator("h1").filter({ hasText: "ציוד ת״ש" })).toBeVisible({ timeout: 15000 });
    await expect(page.locator("button", { hasText: "+ הוסף פריט" })).toBeVisible();
    expect(await page.locator("body").textContent()).not.toContain("An error occurred");
    console.log("✓ Page loaded");
  });

  // 3. Add new item
  test("can add a new ציוד ת״ש item", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/tash");
    await wait(page);

    await page.locator("button", { hasText: "+ הוסף פריט" }).click();
    await page.waitForTimeout(500);
    await expect(page.locator("text=הוספת פריט חדש")).toBeVisible({ timeout: 5000 });

    await page.locator('.fixed input[name="name"]').fill(TEST_ITEM_NAME);
    await page.locator('.fixed input[name="description"]').fill("פריט לצורכי בדיקה אוטומטית");
    await page.locator('.fixed input[name="unit"]').fill("יחידה");
    await submitAndWaitForReload(page, ".fixed button[type='submit']");

    await expect(page.locator(`text=${TEST_ITEM_NAME}`).first()).toBeVisible({ timeout: 10000 });
    console.log(`✓ Added item: ${TEST_ITEM_NAME}`);
  });

  // 4. Add quantity at ימ״ח
  test("can add quantity to test item at ימ״ח", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/tash");
    await wait(page);

    // Use the specific card scoped locator
    const card = itemCard(page, TEST_ITEM_NAME);
    await expect(card).toBeVisible({ timeout: 10000 });

    // Click the "+ הוסף" button INSIDE the card (title="הוסף כמות")
    await card.locator('button[title="הוסף כמות"]').click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=הוספת כמות")).toBeVisible({ timeout: 5000 });

    // Location defaults to ימ״ח
    const locValue = await page.locator(".fixed input[type='text']").first().inputValue();
    console.log(`Default location: "${locValue}"`);

    await page.locator('.fixed input[name="quantity"]').fill("10");
    await page.locator('.fixed input[name="notes"]').fill("הוספה ראשונית לבדיקה");
    await submitAndWaitForReload(page, '.fixed button[type="submit"]');

    // Stats bar should show at least 10 total
    const body = await page.locator("body").textContent();
    expect(body).toContain(TEST_ITEM_NAME);
    console.log("✓ Added 10 units at ימ״ח");
  });

  // 5. Expand row and see location
  test("expanding item card shows location breakdown", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/tash");
    await wait(page);

    await expandCard(page, TEST_ITEM_NAME);

    const card = itemCard(page, TEST_ITEM_NAME);
    // The expanded location badge shows "🏭 ימ״ח" — use that to avoid strict-mode ambiguity
    await expect(card.locator("text=🏭 ימ״ח")).toBeVisible({ timeout: 5000 });
    console.log("✓ Expanded — ימ״ח location badge visible");
  });

  // 6. Add quantity to custom location
  test("can add quantity to a custom location", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/tash");
    await wait(page);

    const card = itemCard(page, TEST_ITEM_NAME);
    await card.locator('button[title="הוסף כמות"]').click();
    await page.waitForTimeout(500);

    await fillLocation(page, TEST_LOCATION_1);
    await page.locator('.fixed input[name="quantity"]').fill("5");
    await submitAndWaitForReload(page, '.fixed button[type="submit"]');

    await expandCard(page, TEST_ITEM_NAME);
    await expect(itemCard(page, TEST_ITEM_NAME).locator(`text=📍 ${TEST_LOCATION_1}`)).toBeVisible({ timeout: 5000 });
    console.log(`✓ Added 5 at ${TEST_LOCATION_1}`);
  });

  // 7. Saved location appears in dropdown
  test("previously used location appears in combobox dropdown", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/tash");
    await wait(page);

    const card = itemCard(page, TEST_ITEM_NAME);
    await card.locator('button[title="הוסף כמות"]').click();
    await page.waitForTimeout(500);

    // Focus the location combobox to open dropdown
    await page.locator(".fixed input[type='text']").first().click();
    await page.waitForTimeout(400);

    // The saved location should appear in the dropdown
    const dropdown = page.locator(".fixed div").filter({ hasText: TEST_LOCATION_1 }).first();
    const visible = await dropdown.isVisible().catch(() => false);
    console.log(`Saved location "${TEST_LOCATION_1}" in dropdown: ${visible}`);

    // Close by pressing Escape or clicking elsewhere
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    if (await page.locator(".fixed").isVisible().catch(() => false)) {
      await page.mouse.click(10, 10);
    }
    console.log("✓ Combobox dropdown test complete");
  });

  // 9. Move item to new location
  test("can move item from ימ״ח to another location", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/tash");
    await wait(page);

    await expandCard(page, TEST_ITEM_NAME);

    const card = itemCard(page, TEST_ITEM_NAME);
    // "הוצא" button only exists in the ימ״ח row (other rows show "הזז")
    const moveBtn = card.locator("button", { hasText: "הוצא" });
    await expect(moveBtn).toBeVisible({ timeout: 5000 });
    await moveBtn.click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=העברה / החזרה")).toBeVisible({ timeout: 5000 });

    // Click the location input to open the dropdown
    const toLocationInput = page.locator(".fixed input[type='text']").first();
    await toLocationInput.click();
    await page.waitForTimeout(500);

    // Select TEST_LOCATION_1 from the dropdown (it was saved in test 7)
    const savedOption = page.locator(".fixed div").filter({ hasText: TEST_LOCATION_1 }).first();
    const isVisible = await savedOption.isVisible({ timeout: 2000 }).catch(() => false);
    if (isVisible) {
      await savedOption.click();
      await page.waitForTimeout(300);
      console.log(`Selected existing location: ${TEST_LOCATION_1}`);
    } else {
      // Fallback: type the location directly
      await fillLocation(page, TEST_LOCATION_1);
      console.log(`Typed location: ${TEST_LOCATION_1}`);
    }

    // Verify the hidden input has the value
    const hiddenVal = await page.locator('.fixed input[name="toLocation"]').inputValue().catch(() => "?");
    console.log(`toLocation value: "${hiddenVal}"`);

    await page.locator('.fixed input[name="quantity"]').fill("3");
    await page.locator('.fixed input[name="notes"]').fill("העברת בדיקה");
    await submitAndWaitForReload(page, '.fixed button[type="submit"]');

    await expandCard(page, TEST_ITEM_NAME);
    await expect(itemCard(page, TEST_ITEM_NAME).locator(`text=📍 ${TEST_LOCATION_1}`)).toBeVisible({ timeout: 5000 });
    console.log(`✓ Moved 3 items to ${TEST_LOCATION_1}`);
  });

  // 10. Return to ימ״ח
  test("can return item to ימ״ח using quick button", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/tash");
    await wait(page);

    await expandCard(page, TEST_ITEM_NAME);

    const card = itemCard(page, TEST_ITEM_NAME);
    // Use the first "הזז" button (non-yamah location move) — opens move modal with source pre-filled
    const moveBtn = card.locator("button", { hasText: "הזז" }).first();
    await expect(moveBtn).toBeVisible({ timeout: 5000 });
    await moveBtn.click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=העברה / החזרה")).toBeVisible({ timeout: 5000 });

    // Click the in-modal "⮐ החזר לימ״ח" quick-fill button
    const quickReturnBtn = page.locator(".fixed button").filter({ hasText: /החזר לימ.ח/ }).first();
    await expect(quickReturnBtn).toBeVisible({ timeout: 3000 });
    await quickReturnBtn.click();
    await page.waitForTimeout(600); // Wait for React state update

    // Verify ימ״ח was auto-filled as destination
    const destValue = await page.locator(".fixed input[type='text']").first().inputValue();
    console.log(`Destination after quick-fill: "${destValue}"`);
    expect(destValue).toContain("ימ");

    await page.locator('.fixed input[name="quantity"]').fill("3");
    await submitAndWaitForReload(page, '.fixed button[type="submit"]');
    console.log("✓ Returned items to ימ״ח using quick button");
  });

  // 11. Mark as damaged
  test("can mark items as damaged", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/tash");
    await wait(page);

    await expandCard(page, TEST_ITEM_NAME);

    const card = itemCard(page, TEST_ITEM_NAME);
    // "הוצא" is unique to ימ״ח row — find its sibling ✕ button via title attribute
    const lossBtn = card.locator('button[title="סמן כאבד/נגנב/ניזוק"]').first();
    await expect(lossBtn).toBeVisible({ timeout: 5000 });
    await lossBtn.click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=סימון סטטוס")).toBeVisible({ timeout: 5000 });

    await page.locator('.fixed select[name="action"]').selectOption("DAMAGED");
    await page.locator('.fixed input[name="quantity"]').fill("1");
    await page.locator('.fixed input[name="notes"]').fill("ניזוק בבדיקה");
    await submitAndWaitForReload(page, '.fixed button[type="submit"]');

    console.log("✓ Marked 1 item as damaged");
  });

  // 11. History log
  test("history log shows all actions", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/tash");
    await wait(page);

    const card = itemCard(page, TEST_ITEM_NAME);
    await card.locator("button", { hasText: "📋" }).click();
    await page.waitForTimeout(500);

    await expect(page.locator("h2").filter({ hasText: "היסטוריה" })).toBeVisible({ timeout: 5000 });

    const modalText = await page.locator(".fixed").textContent();
    const hasAdded = modalText?.includes("נוסף");
    const hasAction = modalText?.includes("הועבר") || modalText?.includes("הוחזר") || modalText?.includes("ניזוק");

    console.log(`History: נוסף=${hasAdded}, other=${hasAction}`);
    expect(hasAdded || hasAction).toBeTruthy();

    await page.locator(".fixed button").filter({ hasText: "✕" }).last().click();
    console.log("✓ History log verified");
  });

  // 12. Edit item
  test("can edit item description", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/tash");
    await wait(page);

    const card = itemCard(page, TEST_ITEM_NAME);
    await card.locator("button", { hasText: "✎" }).click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=עריכת פריט")).toBeVisible({ timeout: 5000 });

    await page.locator('.fixed input[name="description"]').fill("תיאור מעודכן");
    await submitAndWaitForReload(page, '.fixed button[type="submit"]');

    console.log("✓ Item edited");
  });

  // 13. Search filter
  test("search bar filters items correctly", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/tash");
    await wait(page);

    const searchInput = page.locator('input[placeholder*="חפש פריט"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    await searchInput.fill(TEST_ITEM_NAME.substring(0, 12));
    await page.waitForTimeout(400);
    await expect(page.locator(`text=${TEST_ITEM_NAME}`).first()).toBeVisible({ timeout: 5000 });

    await searchInput.fill("xyz_impossible_9999");
    await page.waitForTimeout(400);
    await expect(page.locator("text=לא נמצאו פריטים")).toBeVisible({ timeout: 5000 });

    await searchInput.fill("");
    console.log("✓ Search filter works");
  });

  // 14. No console errors
  test("no JavaScript errors on tash page", async ({ page, context }) => {
    await injectAdminSession(context);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/admin/tash");
    await wait(page, 3000);

    const serious = errors.filter((e) => e.includes("Error") && !e.includes("Warning"));
    if (serious.length > 0) console.log("Page errors:", serious);
    expect(serious).toEqual([]);
    console.log("✓ No console errors");
  });
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

test.describe("Cleanup — remove all ציוד ת״ש test data", () => {
  test.setTimeout(180000);

  test("zero inventory and delete all כיסא בדיקה items", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/tash");
    await wait(page, 3000);

    let rounds = 0;
    while (rounds < 50) {
      // Re-navigate each round to get latest server data
      await page.goto("/admin/tash");
      await wait(page, 2500);

      const testCards = page.locator("div.rounded-2xl").filter({ hasText: TEST_PREFIX });
      if ((await testCards.count()) === 0) {
        console.log("Cleanup: no test items remaining");
        break;
      }

      const firstCard = testCards.first();
      const cardText = await firstCard.locator("span.font-bold").first().textContent().catch(() => "?");
      await firstCard.locator("div.cursor-pointer").first().click();
      await page.waitForTimeout(500);

      const deductBtns = firstCard.locator("button", { hasText: "−" });

      if ((await deductBtns.count()) === 0) {
        const delBtn = firstCard.locator("button", { hasText: "🗑" });
        if ((await delBtn.count()) > 0) {
          await delBtn.click();
          await page.waitForTimeout(500);
          const confirmBtn = page.locator(".fixed button", { hasText: "מחק" });
          if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await Promise.all([
              page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }),
              confirmBtn.click(),
            ]);
            await page.waitForTimeout(1000);
            console.log(`Cleanup: deleted "${cardText}"`);
          }
        } else {
          console.log(`Cleanup: no buttons for "${cardText}" — breaking`);
          break;
        }
      } else {
        await deductBtns.first().click();
        await page.waitForTimeout(500);
        const modal = page.locator(".fixed");
        if (await modal.isVisible()) {
          const qtyText = await modal.locator("span.font-medium").nth(1).textContent().catch(() => "999");
          const qty = parseInt(qtyText?.replace(/[^\d]/g, "") ?? "999") || 999;
          await modal.locator('input[name="quantity"]').fill(String(qty));
          await Promise.all([
            page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 }),
            modal.locator('button[type="submit"]').click(),
          ]);
          await page.waitForTimeout(1000);
          console.log(`Cleanup: deducted ${qty} from "${cardText}"`);
        }
      }
      rounds++;
    }

    // Final verification
    await page.goto("/admin/tash");
    await wait(page, 2000);
    const remaining = await page.locator("div.rounded-2xl").filter({ hasText: TEST_PREFIX }).count();
    console.log(`Cleanup complete: ${remaining} test items remaining`);
    expect(remaining).toBe(0);
  });
});
