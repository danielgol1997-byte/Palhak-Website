/**
 * Read-only desktop smoke checks: every main route renders for an admin without
 * console errors, the 3D cards exist on the dashboards, and the header nav works.
 *   PW_BASE_URL=http://localhost:3001 npx playwright test tests/desktop.spec.ts --project=chromium
 */
import { test, expect, type BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { config as loadDotenv } from "dotenv";
import { mkdirSync } from "node:fs";

// Mirror Next.js precedence: .env.local overrides .env (dotenv never overwrites a key already set).
loadDotenv({ path: ".env.local" });
loadDotenv({ path: ".env" });
const SECRET = process.env.NEXTAUTH_SECRET ?? "";
// NextAuth switches to the __Secure- cookie when NEXTAUTH_URL is https (e.g. after `vercel env pull`).
const SECURE_COOKIES = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
const SESSION_COOKIE = SECURE_COOKIES ? "__Secure-next-auth.session-token" : "next-auth.session-token";
const SHOT_DIR = process.env.PW_SHOT_DIR ?? "test-results/desktop-shots";
mkdirSync(SHOT_DIR, { recursive: true });

async function login(context: BrowserContext) {
  const token = await encode({
    token: {
      sub: "cmka0meph0000xcen4xre4jqf",
      name: "דניאל גולדברג",
      role: "THEME_MASTER",
      active: true,
      onboardedAt: "2026-01-15T09:59:00.963Z",
      roleCheckedAt: Date.now(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    secret: SECRET,
  });
  await context.addCookies([
    { name: SESSION_COOKIE, value: token, domain: "localhost", path: "/", httpOnly: true, secure: SECURE_COOKIES, sameSite: "Lax" },
  ]);
}

const ROUTES = [
  "/me",
  "/requests",
  "/personal",
  "/admin",
  "/admin/users",
  "/admin/requests",
  "/admin/inventory/storage",
  "/admin/inventory/items",
  "/admin/inventory/unit-templates",
  "/admin/inventory/box-template",
  "/admin/org/departments",
  "/admin/org/positions",
  "/admin/boxes",
  "/admin/exports",
  "/admin/weapons-and-sights",
  "/admin/tash",
  "/admin/backups",
];

test.describe("desktop smoke", () => {
  test.beforeEach(async ({ context }) => {
    test.skip(!SECRET, "NEXTAUTH_SECRET missing");
    await login(context);
  });

  for (const route of ROUTES) {
    test(`renders ${route} without console errors`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(800);
      await expect(page).not.toHaveURL(/\/auth/);
      await page.screenshot({ path: `${SHOT_DIR}/desktop${route.replace(/\//g, "_")}.png` });
      const real = errors.filter((e) => !/favicon|hydration|Download the React DevTools/i.test(e));
      expect(real, `console errors on ${route}`).toEqual([]);
    });
  }

  test("3D cards on dashboards, desktop header nav, no bottom nav", async ({ page }) => {
    await page.goto("/me");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator(".theme-3d-card-inner").first()).toBeVisible();
    // bottom nav is hidden on desktop
    const bottomNav = page.getByTestId("bottom-nav");
    await expect(bottomNav).toBeHidden();
    // header nav link navigates
    await page.getByRole("navigation", { name: "ניווט ראשי" }).first().getByRole("link", { name: "ניהול" }).click();
    await page.waitForURL(/\/admin$/);
    await expect(page.locator(".theme-3d-card-inner").first()).toBeVisible();
    expect(await page.locator(".theme-3d-card-inner").count()).toBeGreaterThanOrEqual(8);
  });

  test("notification popover and design studio open on desktop", async ({ page }) => {
    await page.goto("/me");
    await page.waitForLoadState("domcontentloaded");
    await page.getByRole("button", { name: /התראות/ }).click();
    await expect(page.getByRole("heading", { name: "התראות" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /סטודיו עיצוב/ }).click();
    const dlg = page.getByRole("dialog", { name: /סטודיו עיצוב/ });
    await expect(dlg).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOT_DIR}/desktop-studio.png` });
    // switch tabs inside the studio
    await dlg.getByRole("tab", { name: /צבעים/ }).click();
    await expect(dlg.getByText("התחל מהערכה הנוכחית")).toBeVisible();
    await dlg.getByRole("tab", { name: /כללי/ }).click();
    await expect(dlg.getByText("גודל טקסט כללי")).toBeVisible();
  });
});
