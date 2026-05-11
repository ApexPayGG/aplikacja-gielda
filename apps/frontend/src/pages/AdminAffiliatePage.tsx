import { useEffect, useMemo, useState } from "react";
import {
  createAdminAffiliateBroker,
  deleteAdminAffiliateBroker,
  getAdminAffiliateBrokers,
  importAdminAffiliateCsv,
  updateAdminAffiliateBroker,
  type AdminAffiliateBrokerPayload,
} from "../services/api";
import { apiErrorMessage } from "../utils/apiErrorMessage";

type BrokerFormState = {
  slug: string;
  displayName: string;
  partnerId: string;
  baseUrl: string;
  tickerUrlTemplate: string;
  supportedCountries: string;
  supportedMarkets: string;
  attributionMethod: string;
  commissionModel: string;
  commissionCurrency: string;
  conversionTracking: string;
  priority: number;
  isActive: boolean;
};

const EMPTY_FORM: BrokerFormState = {
  slug: "",
  displayName: "",
  partnerId: "",
  baseUrl: "",
  tickerUrlTemplate: "",
  supportedCountries: "",
  supportedMarkets: "",
  attributionMethod: "click_id",
  commissionModel: "cpa",
  commissionCurrency: "EUR",
  conversionTracking: "manual_csv",
  priority: 100,
  isActive: false,
};

function toCsvString(values: string[]): string {
  return values.join(", ");
}

function parseCsvInput(raw: string): string[] {
  return raw
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
}

function normalizeFormFromBroker(broker: AdminAffiliateBrokerPayload): BrokerFormState {
  return {
    slug: broker.slug,
    displayName: broker.displayName,
    partnerId: broker.partnerId,
    baseUrl: broker.baseUrl,
    tickerUrlTemplate: broker.tickerUrlTemplate ?? "",
    supportedCountries: toCsvString(broker.supportedCountries ?? []),
    supportedMarkets: toCsvString(broker.supportedMarkets ?? []),
    attributionMethod: broker.attributionMethod,
    commissionModel: broker.commissionModel,
    commissionCurrency: broker.commissionCurrency,
    conversionTracking: broker.conversionTracking ?? "",
    priority: broker.priority,
    isActive: broker.isActive,
  };
}

function formToPayload(form: BrokerFormState): AdminAffiliateBrokerPayload {
  return {
    slug: form.slug.trim().toLowerCase(),
    displayName: form.displayName.trim(),
    partnerId: form.partnerId.trim(),
    baseUrl: form.baseUrl.trim(),
    tickerUrlTemplate: form.tickerUrlTemplate.trim() || null,
    supportedCountries: parseCsvInput(form.supportedCountries),
    supportedMarkets: parseCsvInput(form.supportedMarkets),
    attributionMethod: form.attributionMethod.trim() || "click_id",
    commissionModel: form.commissionModel.trim() || "cpa",
    commissionCurrency: form.commissionCurrency.trim().toUpperCase() || "EUR",
    conversionTracking: form.conversionTracking.trim() || null,
    priority: Number(form.priority) || 100,
    isActive: form.isActive,
  };
}

export function AdminAffiliatePage() {
  const [brokers, setBrokers] = useState<AdminAffiliateBrokerPayload[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [form, setForm] = useState<BrokerFormState>(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [csvBrokerSlug, setCsvBrokerSlug] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [csvResult, setCsvResult] = useState<string | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);

  const selectedBroker = useMemo(
    () => brokers.find((b) => b.slug === selectedSlug) ?? null,
    [brokers, selectedSlug],
  );

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminAffiliateBrokers();
      setBrokers(data);
      if (!selectedSlug && data.length > 0) {
        setSelectedSlug(data[0].slug);
        setForm(normalizeFormFromBroker(data[0]));
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedBroker || isCreating) return;
    setForm(normalizeFormFromBroker(selectedBroker));
  }, [selectedBroker, isCreating]);

  const handleSelect = (slug: string) => {
    setSelectedSlug(slug);
    setIsCreating(false);
    const broker = brokers.find((b) => b.slug === slug);
    if (broker) setForm(normalizeFormFromBroker(broker));
    setSuccess(null);
    setError(null);
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setSelectedSlug(null);
    setForm(EMPTY_FORM);
    setSuccess(null);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = formToPayload(form);
      if (isCreating) {
        const created = await createAdminAffiliateBroker(payload);
        setBrokers((prev) =>
          [...prev, created].sort((a, b) => a.priority - b.priority || a.displayName.localeCompare(b.displayName)),
        );
        setSelectedSlug(created.slug);
        setIsCreating(false);
        setSuccess(`Created broker: ${created.displayName}`);
      } else if (selectedSlug) {
        const updated = await updateAdminAffiliateBroker(selectedSlug, payload);
        setBrokers((prev) =>
          prev
            .map((b) => (b.slug === selectedSlug ? updated : b))
            .sort((a, b) => a.priority - b.priority || a.displayName.localeCompare(b.displayName)),
        );
        setSelectedSlug(updated.slug);
        setSuccess(`Updated broker: ${updated.displayName}`);
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSlug) return;
    const confirmed = window.confirm(`Delete broker "${selectedSlug}"?`);
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteAdminAffiliateBroker(selectedSlug);
      const next = brokers.filter((b) => b.slug !== selectedSlug);
      setBrokers(next);
      if (next.length > 0) {
        setSelectedSlug(next[0].slug);
        setForm(normalizeFormFromBroker(next[0]));
      } else {
        setSelectedSlug(null);
        setForm(EMPTY_FORM);
      }
      setSuccess(`Deleted broker: ${selectedSlug}`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCsvImport = async () => {
    if (!csvBrokerSlug.trim() || !csvContent.trim()) return;
    setCsvLoading(true);
    setCsvResult(null);
    setError(null);
    try {
      const result = await importAdminAffiliateCsv({
        brokerSlug: csvBrokerSlug.trim().toLowerCase(),
        csvContent,
      });
      setCsvResult(
        `Imported: ${result.imported} | Matched: ${result.matched} | Unmatched: ${result.unmatched} | Errors: ${result.errors.length}`,
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setCsvLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-slate-100">
      <h1 className="text-2xl font-bold text-white">Admin - Affiliate Brokers</h1>
      <p className="mt-1 text-sm text-slate-400">
        Basic CRUD for broker configs + manual CSV conversion import.
      </p>

      {error && <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {success && <div className="mt-4 rounded border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">{success}</div>}

      <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-xl border border-surface-border bg-slate-900/60 p-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Brokers</h2>
            <button
              type="button"
              onClick={handleCreateNew}
              className="rounded bg-brand-blue/20 px-2 py-1 text-xs text-brand-blue hover:bg-brand-blue/30"
            >
              + New
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : (
            <div className="space-y-2">
              {brokers.map((broker) => (
                <button
                  key={broker.slug}
                  type="button"
                  onClick={() => handleSelect(broker.slug)}
                  className={`w-full rounded border px-2 py-2 text-left text-sm ${
                    selectedSlug === broker.slug && !isCreating
                      ? "border-brand-green/50 bg-brand-green/10 text-white"
                      : "border-surface-border bg-slate-950/40 text-slate-300 hover:border-brand-blue/40"
                  }`}
                >
                  <div className="font-medium">{broker.displayName}</div>
                  <div className="text-xs text-slate-500">
                    {broker.slug} · priority {broker.priority} · {broker.isActive ? "active" : "inactive"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="rounded-xl border border-surface-border bg-slate-900/60 p-4">
          <h2 className="mb-4 text-lg font-semibold text-white">
            {isCreating ? "Create Broker" : selectedSlug ? `Edit: ${selectedSlug}` : "Select broker"}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Slug" value={form.slug} onChange={(v) => setForm((s) => ({ ...s, slug: v }))} />
            <Field label="Display Name" value={form.displayName} onChange={(v) => setForm((s) => ({ ...s, displayName: v }))} />
            <Field label="Partner ID" value={form.partnerId} onChange={(v) => setForm((s) => ({ ...s, partnerId: v }))} />
            <Field label="Base URL" value={form.baseUrl} onChange={(v) => setForm((s) => ({ ...s, baseUrl: v }))} />
            <Field label="Ticker URL Template" value={form.tickerUrlTemplate} onChange={(v) => setForm((s) => ({ ...s, tickerUrlTemplate: v }))} />
            <Field label="Supported Countries (CSV)" value={form.supportedCountries} onChange={(v) => setForm((s) => ({ ...s, supportedCountries: v }))} />
            <Field label="Supported Markets (CSV)" value={form.supportedMarkets} onChange={(v) => setForm((s) => ({ ...s, supportedMarkets: v }))} />
            <Field label="Attribution Method" value={form.attributionMethod} onChange={(v) => setForm((s) => ({ ...s, attributionMethod: v }))} />
            <Field label="Commission Model" value={form.commissionModel} onChange={(v) => setForm((s) => ({ ...s, commissionModel: v }))} />
            <Field label="Currency" value={form.commissionCurrency} onChange={(v) => setForm((s) => ({ ...s, commissionCurrency: v }))} />
            <Field label="Conversion Tracking" value={form.conversionTracking} onChange={(v) => setForm((s) => ({ ...s, conversionTracking: v }))} />
            <Field
              label="Priority"
              value={String(form.priority)}
              onChange={(v) => setForm((s) => ({ ...s, priority: Number(v) || 100 }))}
            />
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))}
            />
            Active
          </label>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded bg-brand-green px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
            >
              {saving ? "Saving..." : isCreating ? "Create" : "Save changes"}
            </button>
            {!isCreating && selectedSlug && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={saving}
                className="rounded border border-red-500/50 px-3 py-2 text-sm text-red-300 disabled:opacity-60"
              >
                Delete
              </button>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-surface-border bg-slate-900/60 p-4">
        <h2 className="text-lg font-semibold text-white">Manual CSV Import</h2>
        <p className="mt-1 text-sm text-slate-400">
          Endpoint wrapper for first conversion tests (Postman/curl compatible).
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-[200px_1fr]">
          <Field
            label="Broker slug"
            value={csvBrokerSlug}
            onChange={setCsvBrokerSlug}
            placeholder="xtb"
          />
          <div>
            <label className="mb-1 block text-xs text-slate-400">CSV content</label>
            <textarea
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              rows={8}
              className="w-full rounded border border-surface-border bg-slate-950/50 px-3 py-2 text-sm text-slate-100 focus:border-brand-blue focus:outline-none"
              placeholder="click_id,conversion_type,commission_amount,currency,conversion_date"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleCsvImport()}
          disabled={csvLoading}
          className="mt-3 rounded bg-brand-blue/20 px-3 py-2 text-sm font-semibold text-brand-blue disabled:opacity-60"
        >
          {csvLoading ? "Importing..." : "Import CSV"}
        </button>
        {csvResult && <p className="mt-2 text-sm text-green-300">{csvResult}</p>}
      </section>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs text-slate-400">{props.label}</span>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="w-full rounded border border-surface-border bg-slate-950/50 px-3 py-2 text-sm text-slate-100 focus:border-brand-blue focus:outline-none"
      />
    </label>
  );
}
