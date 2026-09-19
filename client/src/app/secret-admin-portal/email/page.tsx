"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import {
  getAdminUsers,
  sendAdminUserEmail,
  type AdminUserListItem,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";

export default function AdminSendEmailPage() {
  const ready = useRequireAdmin();
  const t = useTranslations("admin.email");
  const tCommon = useTranslations("common");

  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const visibleUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => user.email.toLowerCase().includes(q));
  }, [users, search]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedId) ?? null,
    [users, selectedId]
  );

  useEffect(() => {
    if (!ready) return;
    let mounted = true;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await getAdminUsers();
        if (!mounted) return;
        setUsers(response.data);
      } catch (error) {
        if (!mounted) return;
        setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [ready, tCommon]);

  function selectUser(user: AdminUserListItem) {
    setSelectedId(user.id);
    setEmail(user.email);
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    const match = users.find((user) => user.email.toLowerCase() === value.trim().toLowerCase());
    setSelectedId(match ? match.id : null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSending) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();

    if (!selectedId && !trimmedEmail) {
      setErrorMessage(t("errors.userRequired"));
      return;
    }
    if (!trimmedSubject) {
      setErrorMessage(t("errors.subjectRequired"));
      return;
    }
    if (!trimmedBody) {
      setErrorMessage(t("errors.bodyRequired"));
      return;
    }

    setIsSending(true);
    try {
      const response = await sendAdminUserEmail({
        userId: selectedId ?? undefined,
        email: selectedId ? undefined : trimmedEmail,
        subject: trimmedSubject,
        body: trimmedBody,
      });
      setSuccessMessage(t("success", { email: response.data.to }));
      setSubject("");
      setBody("");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t("errors.generic")));
    } finally {
      setIsSending(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="page-shell">
      <AdminNav />
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-500">{t("eyebrow")}</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{t("subtitle")}</p>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="card-surface rounded-3xl p-5">
            <label className="block text-sm font-medium text-slate-700" htmlFor="admin-email-to">
              {t("emailLabel")}
            </label>
            <input
              id="admin-email-to"
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder={t("emailPlaceholder")}
              className="input-surface mt-1.5 py-3"
              autoComplete="off"
            />
            {selectedUser ? (
              <p className="mt-2 text-xs text-slate-500">{t("selected", { email: selectedUser.email })}</p>
            ) : null}

            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="admin-email-subject">
              {t("subjectLabel")}
            </label>
            <input
              id="admin-email-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("subjectPlaceholder")}
              className="input-surface mt-1.5 py-3"
              maxLength={200}
            />

            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="admin-email-body">
              {t("bodyLabel")}
            </label>
            <textarea
              id="admin-email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("bodyPlaceholder")}
              className="input-surface mt-1.5 min-h-[220px] py-3"
              maxLength={20000}
            />

            <button
              type="submit"
              disabled={isSending || isLoading}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-brand-500 to-gold-500 py-3 text-sm font-semibold text-white shadow-md disabled:opacity-50"
            >
              {isSending ? t("sending") : t("submit")}
            </button>
          </section>

          <section className="card-surface rounded-3xl p-5">
            <h2 className="text-lg font-semibold text-slate-900">{t("usersTitle")}</h2>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="input-surface mb-4 mt-3 py-2.5"
            />
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
            ) : visibleUsers.length === 0 ? (
              <p className="text-sm text-slate-500">{t("empty")}</p>
            ) : (
              <ul className="max-h-[480px] space-y-2 overflow-y-auto">
                {visibleUsers.map((user) => {
                  const checked = selectedId === user.id;
                  return (
                    <li key={user.id}>
                      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-100 px-3 py-2.5 hover:bg-slate-50">
                        <span className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="admin-email-user"
                            checked={checked}
                            onChange={() => selectUser(user)}
                          />
                          <span>
                            <span className="block text-sm font-medium text-slate-900">{user.email}</span>
                            <span className="block text-xs text-slate-500">{user.status}</span>
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </form>
      </main>
    </div>
  );
}
