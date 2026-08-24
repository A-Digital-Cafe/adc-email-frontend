import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { EmailMessage } from "@common/types/email/Email.ts";
import { isInternalAddress, isValidEmailAddress } from "@common/utils/email-address.ts";
import { useIsCompact } from "@ui-library/utils/use-media-query";
import { mailApi, type ComposePayload, type MailAttachment, type MailPolicy } from "../utils/mail-api.ts";
import type { TFn } from "../types.ts";

interface Props {
	draft: EmailMessage | null;
	/** Política de entrega del servidor; `null` mientras la cuenta no cargó. */
	policy: MailPolicy | null;
	onClose: (didSend: boolean) => void;
	t: TFn;
}

function parseAddresses(value: string): string[] {
	return value
		.split(/[,;]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

export function ComposeModal({ draft, policy, onClose, t }: Readonly<Props>) {
	const composerRef = useRef<HTMLElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	// Redactar en un modal centrado no entra en mobile (editor + adjuntos + teclado):
	// a pantalla completa el cuerpo scrollea y la barra de acciones queda fija abajo.
	const compact = useIsCompact();

	const [draftId, setDraftId] = useState<string | null>(draft?.id ?? null);
	const [to, setTo] = useState((draft?.to ?? []).map((a) => a.address).join(", "));
	const [subject, setSubject] = useState(draft?.subject ?? "");
	const [bodyHtml, setBodyHtml] = useState(draft?.bodyHtml ?? "");
	const [bodyText, setBodyText] = useState(draft?.bodyText ?? "");
	const [scheduledAt, setScheduledAt] = useState("");
	const [attachments, setAttachments] = useState<MailAttachment[]>([]);
	const [busy, setBusy] = useState(false);

	// El envío externo está deshabilitado en el servidor: se avisa acá para no
	// redactar un mensaje entero y chocar recién al enviar. El backend valida
	// igual (esto es sólo UX) y además comprueba que el buzón exista.
	const blockedRecipients = useMemo(() => {
		if (!policy?.internalOnly) return [];
		// Sólo direcciones ya completas: si no, se marcaría en rojo mientras se
		// teclea el dominio. Las malformadas las rechaza el backend (INVALID_ADDRESS).
		return parseAddresses(to).filter((address) => isValidEmailAddress(address) && !isInternalAddress(address, policy.rootDomain));
	}, [to, policy]);

	useEffect(() => {
		if (draft?.id && draft.attachmentIds?.length) {
			mailApi.listAttachments(draft.id).then((res) => {
				if (res.success && res.data) setAttachments(res.data);
			});
		}
	}, [draft]);

	// El composer es un Web Component: escuchamos su evento custom.
	useEffect(() => {
		const el = composerRef.current;
		if (!el) return;
		const onChange = (e: Event) => {
			const detail = (e as CustomEvent<{ html: string; text: string }>).detail;
			setBodyHtml(detail.html);
			setBodyText(detail.text);
		};
		const onRequestAttachment = () => fileInputRef.current?.click();
		el.addEventListener("adcMailChange", onChange);
		el.addEventListener("adcRequestAttachment", onRequestAttachment);
		return () => {
			el.removeEventListener("adcMailChange", onChange);
			el.removeEventListener("adcRequestAttachment", onRequestAttachment);
		};
	}, []);

	const ensureDraft = useCallback(async (): Promise<string | null> => {
		if (draftId) return draftId;
		const res = await mailApi.createDraft({ to: parseAddresses(to), subject, bodyHtml, bodyText });
		if (res.success && res.data) {
			setDraftId(res.data.id);
			return res.data.id;
		}
		return null;
	}, [draftId, to, subject, bodyHtml, bodyText]);

	const handleFile = useCallback(
		async (file: File) => {
			setBusy(true);
			try {
				const id = await ensureDraft();
				if (!id) return;
				const presign = await mailApi.presignUpload(id, {
					fileName: file.name,
					mimeType: file.type || "application/octet-stream",
					size: file.size,
				});
				if (!presign.success || !presign.data) return;
				// Los headers salen del presign tal cual: algunos van firmados (Content-Disposition),
				// así que armarlos a mano rompe la firma.
				const uploaded = await fetch(presign.data.uploadUrl, {
					method: "PUT",
					body: file,
					headers: presign.data.headers,
				});
				if (!uploaded.ok) return;
				const confirmed = await mailApi.confirmUpload(presign.data.attachmentId);
				if (confirmed.success && confirmed.data) setAttachments((prev) => [...prev, confirmed.data!]);
			} finally {
				setBusy(false);
			}
		},
		[ensureDraft]
	);

	const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) handleFile(file);
		e.target.value = "";
	};

	const removeAttachment = async (att: MailAttachment) => {
		await mailApi.deleteAttachment(att.id);
		setAttachments((prev) => prev.filter((a) => a.id !== att.id));
	};

	const saveDraft = useCallback(async () => {
		setBusy(true);
		try {
			const payload: Partial<ComposePayload> = {
				to: parseAddresses(to),
				subject,
				bodyHtml,
				bodyText,
				attachmentIds: attachments.map((a) => a.id),
			};
			if (draftId) await mailApi.updateDraft(draftId, payload);
			else await mailApi.createDraft(payload);
			onClose(false);
		} finally {
			setBusy(false);
		}
	}, [draftId, to, subject, bodyHtml, bodyText, attachments, onClose]);

	const send = useCallback(async () => {
		const recipients = parseAddresses(to);
		if (recipients.length === 0 || blockedRecipients.length > 0) return;
		setBusy(true);
		try {
			const payload: ComposePayload = {
				to: recipients,
				subject,
				bodyHtml,
				bodyText,
				attachmentIds: attachments.map((a) => a.id),
				...(draftId ? { threadId: draft?.threadId } : {}),
				...(scheduledAt ? { scheduledAt: new Date(scheduledAt).toISOString() } : {}),
			};
			const res = await mailApi.send(payload);
			if (res.success) onClose(true);
		} finally {
			setBusy(false);
		}
	}, [to, blockedRecipients, subject, bodyHtml, bodyText, attachments, scheduledAt, draftId, draft, onClose]);

	return (
		<adc-modal open size={compact ? "full" : "lg"} modalTitle={t("compose.title")} onadcClose={() => onClose(false)}>
			<div className="flex flex-col gap-3">
				<label className="flex flex-col gap-1 text-sm">
					{t("compose.to")}
					<input
						type="text"
						value={to}
						onChange={(e) => setTo(e.target.value)}
						placeholder={policy?.internalOnly ? `alguien@${policy.rootDomain}` : "alguien@ejemplo.com"}
						aria-invalid={blockedRecipients.length > 0}
						aria-describedby="compose-to-help"
						className={`rounded-lg border px-3 py-2 ${blockedRecipients.length > 0 ? "border-danger" : "border-text/15"}`}
					/>
					<span id="compose-to-help" className={blockedRecipients.length > 0 ? "text-sm text-tdanger" : "text-xs opacity-70"}>
						{blockedRecipients.length > 0
							? t("compose.externalBlocked", { addresses: blockedRecipients.join(", ") })
							: policy?.internalOnly && t("compose.internalOnlyHint", { domain: policy.rootDomain })}
					</span>
				</label>

				<label className="flex flex-col gap-1 text-sm">
					{t("compose.subject")}
					<input
						type="text"
						value={subject}
						onChange={(e) => setSubject(e.target.value)}
						className="rounded-lg border border-text/15 px-3 py-2"
					/>
				</label>

				<adc-mail-composer ref={composerRef} value={bodyHtml} placeholder={t("compose.bodyPlaceholder")} />

				{attachments.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{attachments.map((att) => (
							<span key={att.id} className="flex items-center gap-2 rounded-lg border border-text/15 px-2 py-1 text-sm">
								📎 {att.fileName}
								<button type="button" aria-label={t("actions.delete")} onClick={() => removeAttachment(att)}>
									✕
								</button>
							</span>
						))}
					</div>
				)}

				<label className="flex flex-col gap-1 text-sm">
					{t("compose.schedule")}
					<input
						type="datetime-local"
						value={scheduledAt}
						onChange={(e) => setScheduledAt(e.target.value)}
						className="w-fit rounded-lg border border-text/15 px-3 py-2"
					/>
				</label>

				<input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelected} />
			</div>

			<div slot="footer" className="flex items-center justify-end gap-2">
				<adc-button variant="accent-outlined" size="small" disabled={busy} label={t("compose.saveDraft")} onClick={saveDraft} />
				<adc-button
					variant="primary"
					size="small"
					disabled={busy || blockedRecipients.length > 0}
					label={scheduledAt ? t("compose.scheduleSend") : t("compose.send")}
					onClick={send}
				/>
			</div>
		</adc-modal>
	);
}
