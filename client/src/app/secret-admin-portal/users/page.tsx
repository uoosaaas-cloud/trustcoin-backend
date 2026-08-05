"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { useRequireAdmin } from "@/hooks/useRequireAdmin";
import {
  approveAdminUser,
  blockAdminUser,
  deleteAdminUser,
  getAdminUsers,
  type AdminUserListItem,
} from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/deposit";
import { formatUsdt, formatDate } from "@/lib/format";

export default function AdminUsersPage() {
  const ready = useRequireAdmin();
  const t = useTranslations("admin.users");
  const tCommon = useTranslations("common");

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewUser, setPreviewUser] = useState<AdminUserListItem | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadUsers(searchQuery: string, status?: string) {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await getAdminUsers(searchQuery || undefined, status || undefined);
      setUsers(response.data);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, tCommon("unknownError")));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!ready) return;

    let mounted = true;

    async function load() {
      if (mounted) setErrorMessage(null);
      try {
        const response = await getAdminUsers(query || undefined, statusFilter || undefined);
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
    const id = window.setInterval(() => {
      void load();
    }, 10_000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, query, statusFilter]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    setQuery(search.trim());
  }

  async function runAction(
    userId: string,
    action: "approve" | "block" | "delete",
    confirmMessage?: string
  ) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }

    setActionUserId(userId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (action === "approve") {
        await approveAdminUser(userId);
        setSuccessMessage(t("messages.approved"));
      } else if (action === "block") {
        await blockAdminUser(userId);
        setSuccessMessage(t("messages.blocked"));
      } else {
        await deleteAdminUser(userId);
        setSuccessMessage(t("messages.deleted"));
        setExpandedId((id) => (id === userId ? null : id));
      }
      await loadUsers(query, statusFilter);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, t("errors.actionFailed")));
    } finally {
      setActionUserId(null);
    }
  }

  if (!ready) return null;

  return (
    <div className="page-shell">
      <AdminNav />

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">{t("eyebrow")}</p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-sm text-slate-400">{t("subtitle")}</p>
        </div>

        <form onSubmit={handleSearch} className="mb-6 flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="input-surface flex-1 py-3"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-surface py-3 sm:w-44"
            aria-label={t("statusFilter")}
          >
            <option value="">{t("statusAll")}</option>
            <option value="PENDING">{t("statusPending")}</option>
            <option value="ACTIVE">{t("statusActive")}</option>
            <option value="BLOCKED">{t("statusBlocked")}</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 px-5 py-3 text-sm font-bold text-[#041016] shadow-md"
          >
            {t("search")}
          </button>
        </form>

        {errorMessage ? (
          <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="mb-4 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
            {successMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-400">{t("empty")}</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const open = expandedId === user.id;
              const busy = actionUserId === user.id;
              const isAdmin = user.role === "ADMIN";
              return (
                <div key={user.id} className="card-surface rounded-3xl p-0">
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : user.id)}
                    className="flex w-full flex-col gap-3 px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-white">{user.email}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {t("registered", { date: formatDate(user.created_at) })} · {user.role} ·{" "}
                        <StatusBadge status={user.status} />
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs sm:text-sm">
                      <div>
                        <p className="text-slate-400">{t("available")}</p>
                        <p className="font-semibold text-emerald-400">{formatUsdt(user.availableBalance)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">{t("locked")}</p>
                        <p className="font-semibold text-cyan-300">{formatUsdt(user.lockedBalance)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">{t("total")}</p>
                        <p className="font-semibold text-white">{formatUsdt(user.totalBalance)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">{t("packages")}</p>
                        <p className="font-semibold text-cyan-300">{user.activePackages.length}</p>
                      </div>
                    </div>
                  </button>

                  {open ? (
                    <div className="space-y-4 border-t border-white/10 px-4 py-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <InfoItem label={t("idNumber")} value={user.id_passport_number ?? t("idMissing")} />
                        <InfoItem label={t("referralCode")} value={user.referral_code} />
                        <InfoItem
                          label={t("verified")}
                          value={user.is_verified ? t("yes") : t("no")}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {user.id_document_path ? (
                          <button
                            type="button"
                            onClick={() => setPreviewUser(user)}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/5"
                          >
                            {t("viewIdPhoto")}
                          </button>
                        ) : (
                          <span className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-slate-400">
                            {t("noIdPhoto")}
                          </span>
                        )}

                        {!isAdmin && user.status !== "ACTIVE" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void runAction(user.id, "approve")}
                            className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            {t("approve")}
                          </button>
                        ) : null}

                        {!isAdmin && user.status !== "BLOCKED" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void runAction(user.id, "block")}
                            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-200 disabled:opacity-50"
                          >
                            {t("block")}
                          </button>
                        ) : null}

                        {!isAdmin ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void runAction(user.id, "delete", t("confirmDelete"))}
                            className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 disabled:opacity-50"
                          >
                            {t("delete")}
                          </button>
                        ) : null}
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold text-white">{t("activePackagesTitle")}</h3>
                        {user.activePackages.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-400">{t("noPackages")}</p>
                        ) : (
                          <div className="table-surface mt-3 border-0 shadow-none">
                            <table className="w-full min-w-[480px] text-left text-sm">
                              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-slate-400">
                                <tr>
                                  <th className="px-4 py-2 font-medium">{t("pkg.name")}</th>
                                  <th className="px-4 py-2 font-medium">{t("pkg.amount")}</th>
                                  <th className="px-4 py-2 font-medium">{t("pkg.daily")}</th>
                                  <th className="px-4 py-2 font-medium">{t("pkg.end")}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-300">
                                {user.activePackages.map((pkg) => (
                                  <tr key={pkg.id} className="hover:bg-white/5/80">
                                    <td className="px-4 py-2 text-white">{pkg.packageName}</td>
                                    <td className="px-4 py-2">{formatUsdt(pkg.currentAmount)} USDT</td>
                                    <td className="px-4 py-2 text-cyan-300">{pkg.dailyProfitPercent}%</td>
                                    <td className="px-4 py-2 text-xs text-slate-400">
                                      {formatDate(pkg.endDate)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {previewUser?.id_document_path ? (
        <IdPreviewModal
          email={previewUser.email}
          idNumber={previewUser.id_passport_number}
          imageUrl={resolveAssetUrl(previewUser.id_document_path)}
          onClose={() => setPreviewUser(null)}
          title={t("idPreviewTitle")}
          closeLabel={tCommon("back")}
        />
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ACTIVE"
      ? "bg-emerald-400/15 text-emerald-300"
      : status === "PENDING"
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-400/15 text-rose-300";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>
      {status}
    </span>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold text-white" dir="ltr">
        {value}
      </p>
    </div>
  );
}

function IdPreviewModal({
  email,
  idNumber,
  imageUrl,
  title,
  closeLabel,
  onClose,
}: {
  email: string;
  idNumber: string | null;
  imageUrl: string;
  title: string;
  closeLabel: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label={closeLabel} className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="card-surface relative z-10 max-h-[90vh] w-full max-w-lg overflow-auto rounded-3xl p-5">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{email}</p>
        {idNumber ? (
          <p className="mt-1 text-xs text-slate-400" dir="ltr">
            ID: {idNumber}
          </p>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="ID document" className="mt-4 max-h-[60vh] w-full rounded-2xl object-contain" />
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-slate-300"
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
