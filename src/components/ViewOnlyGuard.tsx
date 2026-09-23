"use client";

import { useEffect, useState } from "react";
import { VIEW_ONLY_DENIED_MESSAGE } from "@/lib/viewOnlyAccounts";

const WRITE_LABEL =
  /שמור|שמירה|מחק|מחיקה|הוסף|הוספ|אשר|אישור|עדכן|עדכון|שלח|שליח|צור|יציר|דחה|העבר|אפס|שחזר|הקצה|הסר|נתק|ערוך|עריכה|נקה/;

function isMutatingFetch(input: RequestInfo | URL, init?: RequestInit) {
  const requestMethod = input instanceof Request ? input.method : "GET";
  const method = (init?.method || requestMethod || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;

  const headerBag = new Headers(init?.headers);
  if (input instanceof Request) {
    input.headers.forEach((value, key) => {
      if (!headerBag.has(key)) headerBag.set(key, value);
    });
  }
  if (headerBag.has("next-action") || headerBag.has("Next-Action")) return true;

  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  try {
    const url = new URL(rawUrl, window.location.origin);
    if (url.origin !== window.location.origin) return false;
    if (url.pathname.startsWith("/api/auth")) return false;
    if (url.pathname.startsWith("/api/")) return true;
  } catch {
    return false;
  }
  return false;
}

export function ViewOnlyGuard({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const showNotice = () => setNotice(VIEW_ONLY_DENIED_MESSAGE);

    const onSubmit = (event: Event) => {
      const form = event.target instanceof Element ? event.target : null;
      if (form?.closest("[data-view-ok]")) return;
      event.preventDefault();
      event.stopPropagation();
      showNotice();
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest("[data-view-ok]")) return;
      if (target.closest("a[href]")) return;

      const control = target.closest("button, input[type='submit'], input[type='button']");
      if (!(control instanceof HTMLElement)) return;
      if (control.closest("[data-view-ok]")) return;

      const type = control.getAttribute("type");
      const label = (control.textContent || control.getAttribute("aria-label") || "")
        .replace(/\s+/g, " ")
        .trim();
      const isSubmit = type === "submit";
      const looksLikeWrite = control.hasAttribute("data-write") || WRITE_LABEL.test(label);
      if (!isSubmit && !looksLikeWrite) return;

      event.preventDefault();
      event.stopPropagation();
      showNotice();
    };

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (isMutatingFetch(input, init)) {
        showNotice();
        return Promise.reject(new Error(VIEW_ONLY_DENIED_MESSAGE));
      }
      return originalFetch(input, init);
    };

    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    return () => {
      window.fetch = originalFetch;
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <div data-view-only="true" className="flex flex-col gap-4">
      <div className="rounded-2xl border border-amber-900/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
        <span className="font-bold">צפייה בלבד.</span>{" "}
        אפשר לראות את כל מה שמנהל ומשתמש רואים. אי אפשר לשנות, לאשר או למחוק.
      </div>
      {notice && (
        <div className="rounded-2xl border border-amber-700/60 bg-amber-900/30 px-4 py-3 text-sm font-medium text-amber-50">
          {notice}
        </div>
      )}
      {children}
    </div>
  );
}
