/**
 * Read-only mobile layout checks. Runs against a dev server (PW_BASE_URL) with a
 * session cookie minted from NEXTAUTH_SECRET in .env – no data is modified.
 *
 *   PW_BASE_URL=http://localhost:3001 npx playwright test --project=mobile --project=mobile-small
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
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
const SHOT_DIR = process.env.PW_SHOT_DIR ?? "test-results/mobile-shots";
mkdirSync(SHOT_DIR, { recursive: true });

const USERS = {
  themeMaster: { id: "cmka0meph0000xcen4xre4jqf", role: "THEME_MASTER" as const, name: "דניאל גולדברג" },
  user: { id: "cmn4ediwo0000l504h79ism2p", role: "USER" as const, name: "חייל" },
};

async function login(context: BrowserContext, who: keyof typeof USERS) {
  const u = USERS[who];
  const token = await encode({
    token: {
      sub: u.id,
      name: u.name,
      role: u.role,
      active: true,
      onboardedAt: "2026-01-15T09:59:00.963Z",
      roleCheckedAt: Date.now(), // skip the DB role refresh for the first minute
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    secret: SECRET,
  });
  await context.addCookies([
    { name: SESSION_COOKIE, value: token, domain: "localhost", path: "/", httpOnly: true, secure: SECURE_COOKIES, sameSite: "Lax" },
  ]);
}

/** No element may extend past the viewport horizontally. */
async function expectNoHorizontalOverflow(page: Page, label: string) {
  const info = await page.evaluate(() => {
    const vw = window.innerWidth;
    const docOverflow = document.documentElement.scrollWidth - vw;
    const offenders: string[] = [];
    const els = Array.from(document.querySelectorAll<HTMLElement>("body *"));
    for (const el of els) {
      if (offenders.length >= 8) break;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" && (cs.visibility === "hidden" || cs.display === "none")) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Elements inside a horizontally scrollable container are allowed to overflow it.
      if (el.closest(".ui-hscroll, .overflow-x-auto, [data-mobile='scroll'], canvas")) continue;
      if (r.right > vw + 2 || r.left < -2) {
        const id = el.id ? `#${el.id}` : "";
        const cls = typeof el.className === "string" ? "." + el.className.split(/\s+/).slice(0, 3).join(".") : "";
        offenders.push(`${el.tagName.toLowerCase()}${id}${cls} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      }
    }
    return { docOverflow, offenders };
  });
  expect(info.docOverflow, `${label}: document overflows horizontally`).toBeLessThanOrEqual(1);
  expect(info.offenders, `${label}: elements outside viewport`).toEqual([]);
}

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(900);
}

async function shot(page: Page, name: string, projectName: string) {
  await page.screenshot({ path: `${SHOT_DIR}/${projectName}-${name}.png`, fullPage: process.env.PW_FULLPAGE === "1" });
}

const ADMIN_ROUTES = [
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

test.describe("mobile layout (admin)", () => {
  test.beforeEach(async ({ context }) => {
    test.skip(!SECRET, "NEXTAUTH_SECRET missing");
    await login(context, "themeMaster");
  });

  for (const route of ADMIN_ROUTES) {
    test(`no horizontal overflow on ${route}`, async ({ page }, info) => {
      await page.goto(route);
      await settle(page);
      await expect(page).not.toHaveURL(/\/auth/);
      await expectNoHorizontalOverflow(page, route);
      await shot(page, route.replace(/\//g, "_") || "root", info.project.name);
    });
  }

  test("header, hamburger drawer and bottom nav work", async ({ page }, info) => {
    await page.goto("/me");
    await settle(page);
    const burger = page.getByRole("button", { name: "פתח תפריט" });
    await expect(burger).toBeVisible();
    await burger.click();
    const drawer = page.getByRole("dialog", { name: "תפריט" });
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(450); // slide-in animation
    await expectNoHorizontalOverflow(page, "drawer open");
    await shot(page, "drawer", info.project.name);
    await expect(drawer.getByRole("link", { name: "משתמשים" })).toBeVisible();
    await drawer.getByRole("link", { name: "משתמשים" }).click();
    await page.waitForURL(/\/admin\/users/);
    await expect(page.getByRole("dialog", { name: "תפריט" })).toHaveCount(0);
    // bottom nav
    const bottom = page.getByTestId("bottom-nav");
    await expect(bottom).toBeVisible();
    const box = await bottom.boundingBox();
    const vh = await page.evaluate(() => window.innerHeight);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vh + 1);
  });

  test("notification bell opens a full-width sheet", async ({ page }, info) => {
    await page.goto("/me");
    await settle(page);
    await page.getByRole("button", { name: /התראות/ }).click();
    const dlg = page.getByRole("dialog", { name: "התראות" });
    await expect(dlg).toBeVisible();
    await page.waitForTimeout(400);
    const box = await dlg.boundingBox();
    const vw = await page.evaluate(() => window.innerWidth);
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);
    await shot(page, "bell", info.project.name);
    await page.keyboard.press("Escape");
    await expect(dlg).toHaveCount(0);
  });

  test("design studio opens and fits the screen", async ({ page }, info) => {
    await page.goto("/me");
    await settle(page);
    await page.getByRole("button", { name: /סטודיו עיצוב/ }).click();
    const dlg = page.getByRole("dialog", { name: /סטודיו עיצוב/ });
    await expect(dlg).toBeVisible();
    await page.waitForTimeout(400);
    const box = await dlg.boundingBox();
    const vw = await page.evaluate(() => window.innerWidth);
    const vh = await page.evaluate(() => window.innerHeight);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vh + 1);
    await shot(page, "studio", info.project.name);
  });

  test("tables render as cards on phones", async ({ page }, info) => {
    await page.goto("/admin/users");
    await settle(page);
    const table = page.locator("table[data-mobile-ready]").first();
    await expect(table).toBeVisible();
    const display = await table.evaluate((t) => getComputedStyle(t).display);
    expect(display).toBe("block");
    const firstCell = table.locator("tbody td[data-label]").first();
    await expect(firstCell).toBeVisible();
    await shot(page, "users-cards", info.project.name);
  });
});

test.describe("mobile layout (plain user)", () => {
  test.beforeEach(async ({ context }) => {
    test.skip(!SECRET, "NEXTAUTH_SECRET missing");
    await login(context, "user");
  });

  for (const route of ["/me", "/requests", "/personal"]) {
    test(`user: no overflow on ${route}`, async ({ page }, info) => {
      await page.goto(route);
      await settle(page);
      await expect(page).not.toHaveURL(/\/auth/);
      await expectNoHorizontalOverflow(page, route);
      await shot(page, "user" + route.replace(/\//g, "_"), info.project.name);
    });
  }

  test("user cannot see admin nav", async ({ page }) => {
    await page.goto("/me");
    await settle(page);
    await page.getByRole("button", { name: "פתח תפריט" }).click();
    const drawer = page.getByRole("dialog", { name: "תפריט" });
    await expect(drawer.getByRole("link", { name: "משתמשים" })).toHaveCount(0);
  });
});
