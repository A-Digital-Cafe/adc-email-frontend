import { useCallback, useEffect, useState } from "react";
import { toast } from "@ui-library/utils/toast";
import type { SpamMatchType } from "@common/types/email/Email.ts";
import { mailApi, type SenderRule } from "../utils/mail-api.ts";
import type { TFn } from "../types.ts";

interface Props {
	t: TFn;
	/** Dentro del modal de configuración: sin padding externo ni título (los pone el modal). */
	embedded?: boolean;
}

/**
 * Errores del alta con mensaje propio; el resto cae en el genérico. La lista es explícita porque
 * `t()` devuelve la clave cruda cuando no hay traducción, así que un errorKey nuevo se vería tal cual.
 */
const ADD_ERROR_KEYS = new Set(["INVALID_ADDRESS", "INVALID_FIELD", "SPAM_RULE_EXISTS", "TOO_MANY_SENDER_RULES"]);

function formatDate(value: string): string {
	return new Date(value).toLocaleDateString();
}

/** Gestión de la lista personal de remitentes: lo que se bloquea acá cae en `spam`, nunca se descarta. */
export default function BlocklistView({ t, embedded = false }: Readonly<Props>) {
	const [rules, setRules] = useState<SenderRule[]>([]);
	const [limit, setLimit] = useState(0);
	const [loading, setLoading] = useState(true);
	const [matchType, setMatchType] = useState<SpamMatchType>("address");
	const [value, setValue] = useState("");
	const [reason, setReason] = useState("");
	const [error, setError] = useState<string | undefined>();
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		const res = await mailApi.listBlocklist();
		if (res.success && res.data) {
			setRules(res.data.rules);
			setLimit(res.data.limit);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const full = limit > 0 && rules.length >= limit;

	const add = useCallback(async () => {
		const trimmed = value.trim();
		if (!trimmed || busy) return;
		setBusy(true);
		setError(undefined);
		const res = await mailApi.addBlocklistRule({ matchType, value: trimmed, kind: "block", reason: reason.trim() || undefined });
		setBusy(false);
		if (!res.success || !res.data) {
			setError(res.errorKey && ADD_ERROR_KEYS.has(res.errorKey) ? t(`errors.${res.errorKey}`) : t("blocklist.addError"));
			return;
		}
		const created = res.data;
		setRules((prev) => [created, ...prev]);
		setValue("");
		setReason("");
		toast.success(t("blocklist.added"));
	}, [value, busy, matchType, reason, t]);

	const remove = useCallback(
		async (rule: SenderRule) => {
			const res = await mailApi.removeBlocklistRule(rule.id);
			if (!res.success) return;
			setRules((prev) => prev.filter((r) => r.id !== rule.id));
			toast.success(t("blocklist.removed"));
		},
		[t]
	);

	const typeOptions = [
		{ label: t("blocklist.type.address"), value: "address" },
		{ label: t("blocklist.type.domain"), value: "domain" },
	];

	let list;
	if (loading) {
		list = (
			<div className="flex flex-col gap-2" aria-busy="true" aria-label={t("blocklist.loading")}>
				{["s1", "s2", "s3"].map((k) => (
					<adc-skeleton key={k} variant="rectangular" height="52px" />
				))}
			</div>
		);
	} else if (rules.length === 0) {
		list = <p className="p-8 text-center opacity-70">{t("blocklist.empty")}</p>;
	} else {
		list = (
			<ul className="divide-y divide-text/10 rounded-lg border border-text/10">
				{rules.map((rule) => (
					<li key={rule.id} className="flex items-center gap-3 px-3 py-2">
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<span className="truncate font-medium">{rule.value}</span>
								<adc-badge size="sm">{t(`blocklist.type.${rule.matchType}`)}</adc-badge>
								{/* Una regla `allow` en la lista de bloqueados haría exactamente lo contrario de
								    lo que promete el título: se rotula para que no se confunda con un bloqueo. */}
								{rule.kind === "allow" && (
									<adc-badge size="sm" color="green">
										{t("blocklist.kindAllow")}
									</adc-badge>
								)}
							</div>
							{rule.reason && <p className="truncate text-sm opacity-70">{rule.reason}</p>}
							<p className="text-xs opacity-60">
								{t("blocklist.addedAt", { date: formatDate(rule.createdAt) })}
								{rule.expiresAt ? ` · ${t("blocklist.expiresAt", { date: formatDate(rule.expiresAt) })}` : ""}
							</p>
						</div>
						<button
							type="button"
							aria-label={t("blocklist.remove")}
							title={t("blocklist.remove")}
							onClick={() => remove(rule)}
							className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-muted hover:bg-text/10 hover:text-tdanger lg:h-8 lg:w-8"
						>
							<adc-icon-trash size="1rem" />
						</button>
					</li>
				))}
			</ul>
		);
	}

	return (
		<section className={`flex flex-col gap-4 ${embedded ? "" : "p-4 lg:p-6"}`}>
			<header className="flex flex-col gap-1">
				{!embedded && <h2 className="text-lg font-semibold">{t("blocklist.title")}</h2>}
				<p className="text-sm opacity-70">{t("blocklist.description")}</p>
				{limit > 0 && <p className="text-xs opacity-60">{t("blocklist.count", { used: String(rules.length), limit: String(limit) })}</p>}
			</header>

			<adc-card>
				<div className="flex flex-col gap-3 p-4">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start">
						<div className="sm:w-44">
							<adc-select
								value={matchType}
								options={typeOptions}
								onadcChange={(e: CustomEvent<string>) => setMatchType(e.detail === "domain" ? "domain" : "address")}
							/>
						</div>
						<div className="min-w-0 flex-1">
							<adc-input
								value={value}
								ariaLabel={t("blocklist.value")}
								placeholder={matchType === "domain" ? t("blocklist.domainPlaceholder") : t("blocklist.addressPlaceholder")}
								error={error}
								onInput={(e: any) => {
									setValue(e.target.value);
									setError(undefined);
								}}
							/>
						</div>
					</div>

					<adc-input
						value={reason}
						ariaLabel={t("blocklist.reason")}
						placeholder={t("blocklist.reasonPlaceholder")}
						maxLength={200}
						onInput={(e: any) => setReason(e.target.value)}
					/>

					{full && (
						<adc-callout tone="warning" role="status">
							{t("blocklist.full")}
						</adc-callout>
					)}

					<div className="flex justify-end">
						<adc-button
							variant="primary"
							size="small"
							disabled={busy || full || !value.trim()}
							label={t("blocklist.add")}
							onClick={add}
						/>
					</div>
				</div>
			</adc-card>

			{list}
		</section>
	);
}
