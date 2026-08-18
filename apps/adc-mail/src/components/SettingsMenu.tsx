import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@ui-library/utils/toast";
import { useHeaderSettingsGear } from "@ui-library/utils/settings-gear";
import type { AttachmentOverflowPolicy, MailListDensity } from "@common/types/email/Email.ts";
import { mailApi, type MailSettings } from "../utils/mail-api.ts";
import BlocklistView from "../pages/BlocklistView.tsx";
import type { TFn } from "../types.ts";

interface Props {
	t: TFn;
	settings: MailSettings;
	/** El estado vive en `App`: la densidad y el marcado automático los aplica la lista, no este modal. */
	onChange: (patch: Partial<MailSettings>) => void;
}

/** Fila de una preferencia: etiqueta + descripción a la izquierda, control a la derecha. */
function Row({ title, hint, children }: Readonly<{ title: string; hint?: string; children: React.ReactNode }>) {
	return (
		<div className="flex items-start justify-between gap-4 py-3">
			<div className="min-w-0">
				<p className="text-sm font-medium">{title}</p>
				{hint && <p className="text-xs opacity-70">{hint}</p>}
			</div>
			<div className="shrink-0">{children}</div>
		</div>
	);
}

/**
 * Configuración del buzón: la abre el engranaje del header.
 *
 * El guardado es optimista y por preferencia suelta: son opciones independientes y esperar un
 * "Guardar" para tres controles no aporta nada. Si el PATCH falla se revierte y se avisa.
 */
export function SettingsMenu({ t, settings, onChange }: Readonly<Props>) {
	const [open, setOpen] = useState(false);
	const [tab, setTab] = useState("senders");
	const tabsRef = useRef<HTMLElement>(null);

	useHeaderSettingsGear({ enabled: true, label: t("settings.title"), open, onToggle: () => setOpen((v) => !v) });

	// `adcTabChange` es un evento de un web component: React no lo cablea por JSX (ver AdcTabs
	// del resto de las apps), así que va con addEventListener sobre la ref.
	useEffect(() => {
		const el = tabsRef.current;
		if (!el) return;
		const onTab = (e: Event) => setTab((e as CustomEvent<string>).detail);
		el.addEventListener("adcTabChange", onTab);
		return () => el.removeEventListener("adcTabChange", onTab);
	}, [open]);

	const save = useCallback(
		async (patch: Partial<MailSettings>) => {
			const previous = { ...settings };
			onChange(patch);
			const res = await mailApi.updateSettings(patch);
			if (!res.success) {
				onChange(previous);
				toast.error(t("settings.saveError"));
			}
		},
		[settings, onChange, t]
	);

	const tabs = [
		{ id: "senders", label: t("settings.tabs.senders") },
		{ id: "attachments", label: t("settings.tabs.attachments") },
		{ id: "reading", label: t("settings.tabs.reading") },
	];

	return (
		<adc-modal open={open} modalTitle={t("settings.title")} size="lg" onadcClose={() => setOpen(false)}>
			<adc-tabs ref={tabsRef} tabs={JSON.stringify(tabs)} activeTab={tab} variant="underline" />

			<div className="pt-4">
				{tab === "senders" && <BlocklistView t={t} embedded />}

				{tab === "attachments" && (
					<div className="flex flex-col divide-y divide-surface">
						<p className="pb-3 text-sm opacity-70">{t("settings.attachments.description")}</p>
						<Row title={t("settings.attachments.overflowTitle")} hint={t(`settings.attachments.overflowHint.${settings.attachmentOverflow}`)}>
							<adc-select
								value={settings.attachmentOverflow}
								options={JSON.stringify([
									{ value: "drive-link", label: t("settings.attachments.overflow.driveLink") },
									{ value: "reject", label: t("settings.attachments.overflow.reject") },
								])}
								onadcChange={(e: CustomEvent<string>) => save({ attachmentOverflow: e.detail as AttachmentOverflowPolicy })}
							/>
						</Row>
					</div>
				)}

				{tab === "reading" && (
					<div className="flex flex-col divide-y divide-surface">
						<Row title={t("settings.reading.autoMarkRead")} hint={t("settings.reading.autoMarkReadHint")}>
							<adc-toggle
								checked={settings.autoMarkRead}
								aria-label={t("settings.reading.autoMarkRead")}
								onadcChange={(e: CustomEvent<boolean>) => save({ autoMarkRead: e.detail })}
							/>
						</Row>
						<Row title={t("settings.reading.density")} hint={t("settings.reading.densityHint")}>
							<adc-select
								value={settings.listDensity}
								options={JSON.stringify([
									{ value: "comfortable", label: t("settings.reading.densityComfortable") },
									{ value: "compact", label: t("settings.reading.densityCompact") },
								])}
								onadcChange={(e: CustomEvent<string>) => save({ listDensity: e.detail as MailListDensity })}
							/>
						</Row>
					</div>
				)}
			</div>
		</adc-modal>
	);
}
