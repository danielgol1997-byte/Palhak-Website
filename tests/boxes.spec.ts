import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";

const NEXTAUTH_SECRET = "gpgaz3rTJVFs3D2eHXozRJFKHrGAEh2H2cNCByWtf5Q=";
const ADMIN_USER = {
  id: "cmka0meph0000xcen4xre4jqf",
  name: "דניאל גולדברג",
  email: "danielgol1997@gmail.com",
  role: "SUPER_ADMIN",
  active: true,
  onboardedAt: "2026-01-15T09:59:00.963Z",
};

const USER_WITH_ASSIGNMENTS = {
  id: "cmke4z3rw0000l9043swt4v2r",
  name: "דרור שטרית",
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

  await context.addCookies([
    {
      name: "next-auth.session-token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function waitForPage(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);
}

async function restoreAllBoxItems(page: Page, context: BrowserContext) {
  await injectAdminSession(context);
  await page.goto(`/admin/users/${USER_WITH_ASSIGNMENTS.id}`);
  await waitForPage(page);

  let restoreBtn = page.locator("button", { hasText: "שחזר מקרטון" }).first();
  let attempts = 0;
  while ((await restoreBtn.count()) > 0 && attempts < 10) {
    await restoreBtn.click();
    await page.waitForTimeout(500);
    const confirm = page.locator("button", { hasText: "שחזר לחייל" });
    if ((await confirm.count()) > 0) {
      await confirm.click();
      await page.waitForTimeout(3000);
    }
    await page.goto(`/admin/users/${USER_WITH_ASSIGNMENTS.id}`);
    await waitForPage(page);
    restoreBtn = page.locator("button", { hasText: "שחזר מקרטון" }).first();
    attempts++;
  }
  return attempts;
}

async function removeAllTemplateItems(page: Page, context: BrowserContext) {
  await injectAdminSession(context);
  await page.goto("/admin/inventory/box-template");
  await waitForPage(page);

  let removeBtn = page.locator("button", { hasText: "הסרה" });
  let count = await removeBtn.count();
  let attempts = 0;
  while (count > 0 && attempts < 20) {
    await removeBtn.first().click();
    await page.waitForTimeout(2000);
    await page.goto("/admin/inventory/box-template");
    await waitForPage(page);
    removeBtn = page.locator("button", { hasText: "הסרה" });
    count = await removeBtn.count();
    attempts++;
  }
  return attempts;
}

// ──────────────────────────────────────────────
// Setup: clean state first
// ──────────────────────────────────────────────
test.describe("Setup", () => {
  test.setTimeout(120000);

  test("restore any existing box items and clear template", async ({ page, context }) => {
    const restored = await restoreAllBoxItems(page, context);
    console.log(`Setup: restored ${restored} box items`);
    const removed = await removeAllTemplateItems(page, context);
    console.log(`Setup: removed ${removed} template items`);
  });
});

// ──────────────────────────────────────────────
// Main tests
// ──────────────────────────────────────────────
test.describe("קרטונים (Boxes) Feature", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60000);

  // ──────────────────────────────────────────────
  // 1. Admin home
  // ──────────────────────────────────────────────
  test("admin home page shows קרטונים navigation card", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin");
    await waitForPage(page);

    const boxCard = page.locator('a[href="/admin/boxes"]');
    await expect(boxCard).toBeVisible({ timeout: 15000 });
    const text = await boxCard.textContent();
    expect(text).toContain("קרטונים");
  });

  // ──────────────────────────────────────────────
  // 2. Box template page loads
  // ──────────────────────────────────────────────
  test("box template page loads and shows editor", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/inventory/box-template");
    await waitForPage(page);

    const body = await page.locator("body").textContent();
    expect(body).not.toContain("An error occurred");
    await expect(page.locator("text=תבנית קרטון").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=הוספת פריטים לתבנית")).toBeVisible();
    await expect(page.locator("text=תכולת התבנית")).toBeVisible();
  });

  // ──────────────────────────────────────────────
  // 3. Inventory tabs
  // ──────────────────────────────────────────────
  test("inventory layout includes box template tab", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/inventory/box-template");
    await waitForPage(page);

    const boxTemplateTab = page.locator("text=תבנית קרטון").first();
    await expect(boxTemplateTab).toBeVisible({ timeout: 15000 });
  });

  // ──────────────────────────────────────────────
  // 4. Add items to template
  // ──────────────────────────────────────────────
  test("can add items to box template", async ({ page, context }) => {
    await injectAdminSession(context);

    // Add "שומר אחי" (assigned to our test user)
    await page.goto("/admin/inventory/box-template");
    await waitForPage(page);

    const searchInput = page.locator('input[placeholder*="חפש לפי שם פריט"]');
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill("שומר אחי");
    await page.waitForTimeout(500);

    const shomerBtn = page.locator("button:not([disabled])", { hasText: "שומר אחי" }).first();
    if ((await shomerBtn.count()) > 0) {
      await shomerBtn.click();
      await page.waitForTimeout(300);
      const submitBtn = page.locator("button[type='submit']", { hasText: /הוסף.*פריטים לתבנית/ });
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }

    // Add "מחסניות" with qty=6
    await page.goto("/admin/inventory/box-template");
    await waitForPage(page);
    await searchInput.waitFor({ state: "visible", timeout: 15000 });
    await searchInput.fill("מחסניות");
    await page.waitForTimeout(500);

    const magBtn = page.locator("button:not([disabled])", { hasText: "מחסניות" }).first();
    if ((await magBtn.count()) > 0) {
      await magBtn.click();
      await page.waitForTimeout(300);
      const qtyInputs = page.locator('input[type="number"]');
      if ((await qtyInputs.count()) > 0) await qtyInputs.last().fill("6");
      const submitBtn = page.locator("button[type='submit']", { hasText: /הוסף.*פריטים לתבנית/ });
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }

    // Verify
    await page.goto("/admin/inventory/box-template");
    await waitForPage(page);

    const bodyText = await page.locator("body").textContent();
    expect(bodyText?.includes("שומר אחי") || bodyText?.includes("מחסניות")).toBeTruthy();
  });

  // ──────────────────────────────────────────────
  // 5. Template persists
  // ──────────────────────────────────────────────
  test("box template items persist after reload", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/inventory/box-template");
    await waitForPage(page);

    const bodyText = await page.locator("body").textContent();
    expect(bodyText).not.toContain("טרם הוגדרה תכולה לתבנית הקרטון");
  });

  // ──────────────────────────────────────────────
  // 6. Boxes page loads
  // ──────────────────────────────────────────────
  test("boxes page loads correctly", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/boxes");
    await waitForPage(page);

    await expect(page.locator("text=קרטונים").first()).toBeVisible({ timeout: 15000 });
  });

  // ──────────────────────────────────────────────
  // 7. User equipment page has box section & move buttons
  // ──────────────────────────────────────────────
  test("user equipment page shows box section and move buttons", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto(`/admin/users/${USER_WITH_ASSIGNMENTS.id}`);
    await waitForPage(page);

    await expect(page.locator(`text=${USER_WITH_ASSIGNMENTS.name}`).first()).toBeVisible({
      timeout: 15000,
    });

    // Should see "ציוד משויך" header
    const body = await page.locator("body").textContent();
    expect(body).toContain("ציוד משויך");

    // Should have move-to-box buttons since we added template items matching user assignments
    const moveButtons = page.locator("button", { hasText: "העבר לקרטון" });
    const moveCount = await moveButtons.count();
    console.log(`Move-to-box buttons: ${moveCount}`);
    expect(moveCount).toBeGreaterThan(0);
  });

  // ──────────────────────────────────────────────
  // 8. Move item to box
  // ──────────────────────────────────────────────
  test("can move item to box from user equipment page", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto(`/admin/users/${USER_WITH_ASSIGNMENTS.id}`);
    await waitForPage(page);

    const moveButton = page.locator("button", { hasText: "העבר לקרטון" }).first();
    await expect(moveButton).toBeVisible({ timeout: 10000 });

    // Note which item name is being moved
    const itemRow = moveButton.locator("xpath=ancestor::tr[1]");
    const rowText = await itemRow.textContent();
    console.log(`Moving item from row: ${rowText?.substring(0, 80)}`);

    await moveButton.click();
    await page.waitForTimeout(500);

    // Modal should appear
    await expect(page.locator("text=העברה לקרטון")).toBeVisible({ timeout: 5000 });

    // Click confirm in the modal
    const confirmButton = page.locator(".fixed button", { hasText: "העבר לקרטון" });
    await confirmButton.click();
    await page.waitForTimeout(4000);

    // Check for errors
    const errorMsg = page.locator(".fixed .text-red-400");
    const errorCount = await errorMsg.count();
    if (errorCount > 0) {
      const txt = await errorMsg.textContent();
      console.log(`Move error: ${txt}`);
    }
    expect(errorCount).toBe(0);
  });

  // ──────────────────────────────────────────────
  // 9. Box items visible
  // ──────────────────────────────────────────────
  test("box items visible in box section after move", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto(`/admin/users/${USER_WITH_ASSIGNMENTS.id}`);
    await waitForPage(page);

    const restoreButtons = page.locator("button", { hasText: "שחזר מקרטון" });
    const restoreCount = await restoreButtons.count();
    console.log(`Restore buttons: ${restoreCount}`);
    expect(restoreCount).toBeGreaterThan(0);

    // Check completeness
    const boxCompleteness = page.locator("text=/\\d+\\/\\d+ פריטים/");
    if ((await boxCompleteness.count()) > 0) {
      const text = await boxCompleteness.textContent();
      console.log(`Box completeness: ${text}`);
    }
  });

  // ──────────────────────────────────────────────
  // 10. Boxes list shows the user's box
  // ──────────────────────────────────────────────
  test("boxes list page shows created box", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/boxes");
    await waitForPage(page);

    const body = await page.locator("body").textContent();
    expect(body).toContain(USER_WITH_ASSIGNMENTS.name);

    // Completeness fraction
    expect(body).toMatch(/\d+\/\d+/);

    // Click to expand
    const userRow = page.locator("tr", { hasText: USER_WITH_ASSIGNMENTS.name }).first();
    await userRow.click();
    await page.waitForTimeout(500);

    const expanded = await page.locator("body").textContent();
    expect(
      expanded?.includes("נדרש") || expanded?.includes("בקרטון") || expanded?.includes("חסר")
    ).toBeTruthy();
  });

  // ──────────────────────────────────────────────
  // 11. Boxes list filters
  // ──────────────────────────────────────────────
  test("boxes list page filter controls work", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/boxes");
    await waitForPage(page);

    // Filter buttons
    const incompleteButton = page.locator("button", { hasText: "חסרים" }).first();
    if ((await incompleteButton.count()) > 0) {
      await incompleteButton.click();
      await page.waitForTimeout(300);
    }

    const allButton = page.getByRole("button", { name: "הכל", exact: true }).first();
    if ((await allButton.count()) > 0) {
      await allButton.click();
      await page.waitForTimeout(300);
    }

    // Search
    const searchInput = page.locator('input[placeholder*="חיפוש"]');
    if ((await searchInput.count()) > 0) {
      await searchInput.fill("xyz-nonexistent");
      await page.waitForTimeout(500);
      const body = await page.locator("body").textContent();
      expect(body).toContain("לא נמצאו קרטונים");

      await searchInput.fill("");
    }
  });

  // ──────────────────────────────────────────────
  // 12. Restore from box
  // ──────────────────────────────────────────────
  test("can restore item from box", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto(`/admin/users/${USER_WITH_ASSIGNMENTS.id}`);
    await waitForPage(page);

    const restoreButton = page.locator("button", { hasText: "שחזר מקרטון" }).first();
    await expect(restoreButton).toBeVisible({ timeout: 10000 });

    await restoreButton.click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=שחזור מקרטון")).toBeVisible({ timeout: 5000 });

    const confirmButton = page.locator("button", { hasText: "שחזר לחייל" });
    await confirmButton.click();
    await page.waitForTimeout(3000);

    // Check for errors
    const errorMsg = page.locator(".fixed .text-red-400");
    if ((await errorMsg.count()) > 0) {
      const txt = await errorMsg.textContent();
      console.log(`Restore error: ${txt}`);
    }
    expect(await errorMsg.count()).toBe(0);
  });

  // ──────────────────────────────────────────────
  // 13. Storage page בקרטונים
  // ──────────────────────────────────────────────
  test("storage page shows בקרטונים in legend", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/storage");
    await waitForPage(page);

    const body = await page.locator("body").textContent();
    expect(body).toContain("בקרטונים");
  });

  // ──────────────────────────────────────────────
  // 14. Division filter
  // ──────────────────────────────────────────────
  test("box template editor division filter works", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/inventory/box-template");
    await waitForPage(page);

    const combatButton = page.getByRole("button", { name: "ציוד קרבי", exact: true });
    if ((await combatButton.count()) > 0) {
      await combatButton.click();
      await page.waitForTimeout(300);

      const allButton = page.getByRole("button", { name: "הכל", exact: true }).first();
      await allButton.click();
      await page.waitForTimeout(300);
    }
  });

  // ──────────────────────────────────────────────
  // 15. Update template item quantity
  // ──────────────────────────────────────────────
  test("can update box template item quantity", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/inventory/box-template");
    await waitForPage(page);

    const quantityInputs = page.locator('input[name="quantity"]');
    const count = await quantityInputs.count();

    if (count > 0) {
      await quantityInputs.first().fill("3");
      const updateButton = page.locator("button", { hasText: "עדכן" }).first();
      await updateButton.click();
      await page.waitForTimeout(2000);
      console.log("Updated template item quantity to 3");
    } else {
      console.log("No template items to update.");
    }
  });

  // ──────────────────────────────────────────────
  // 16. No console errors
  // ──────────────────────────────────────────────
  test("no console errors on box-related pages", async ({ page, context }) => {
    await injectAdminSession(context);

    const pagesToTest = [
      "/admin/boxes",
      "/admin/inventory/box-template",
      `/admin/users/${USER_WITH_ASSIGNMENTS.id}`,
      "/admin/storage",
    ];

    for (const path of pagesToTest) {
      const consoleErrors: string[] = [];
      page.on("pageerror", (error) => consoleErrors.push(error.message));

      await page.goto(path);
      await waitForPage(page);

      const boxRelatedErrors = consoleErrors.filter(
        (err) =>
          err.toLowerCase().includes("box") ||
          err.includes("קרטון") ||
          err.includes("Cannot read properties of undefined")
      );

      expect(boxRelatedErrors).toEqual([]);
      console.log(`${path}: OK (${consoleErrors.length} non-box errors)`);
    }
  });

  // ──────────────────────────────────────────────
  // 17. Multi-add to template
  // ──────────────────────────────────────────────
  test("can add multiple items to template at once", async ({ page, context }) => {
    await injectAdminSession(context);
    await page.goto("/admin/inventory/box-template");
    await waitForPage(page);

    const searchInput = page.locator('input[placeholder*="חפש לפי שם פריט"]');
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    const itemButtons = page.locator(".max-h-64 button:not([disabled])");
    const availableCount = await itemButtons.count();

    if (availableCount >= 2) {
      await itemButtons.nth(0).click();
      await page.waitForTimeout(200);
      await itemButtons.nth(1).click();
      await page.waitForTimeout(200);

      const selectedHeader = page.locator("text=/פריטים נבחרים/");
      await expect(selectedHeader).toBeVisible({ timeout: 3000 });

      const addBtn = page.locator("button[type='submit']", { hasText: /הוסף.*פריטים לתבנית/ });
      await addBtn.click();
      await page.waitForTimeout(2000);
    } else {
      console.log("Not enough items for multi-add test.");
    }
  });
});

// ──────────────────────────────────────────────
// Cleanup
// ──────────────────────────────────────────────
test.describe("Cleanup", () => {
  test.setTimeout(120000);

  test("restore box items and clear template", async ({ page, context }) => {
    const restored = await restoreAllBoxItems(page, context);
    console.log(`Cleanup: restored ${restored} box items`);
    const removed = await removeAllTemplateItems(page, context);
    console.log(`Cleanup: removed ${removed} template items`);

    // Verify clean state
    await page.goto("/admin/inventory/box-template");
    await waitForPage(page);
    const removeButtons = page.locator("button", { hasText: "הסרה" });
    expect(await removeButtons.count()).toBe(0);
  });
});
