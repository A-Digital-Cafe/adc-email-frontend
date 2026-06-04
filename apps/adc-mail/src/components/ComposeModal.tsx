import { useEffect, useRef, useState, useCallback } from "react";
import type { EmailMessage } from "@common/types/email/Email.ts";
import { mailApi, type ComposePayload, type MailAttachment } from "../utils/mail-api.ts";
import type { TFn } from "../types.ts";

interface Props {
	draft: EmailMessage | null;
	onClose: (didSend: boolean) => void;
	t: TFn;
}

function parseAddresses(value: string): string[] {
	return value
		.split(/[,;]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

export function ComposeModal({ draft, onClose, t }: Props) {
	const composerRef = useRef<HTMLElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const [draftId, setDraftId] = useState<string | null>(draft?.id ?? null);
	const [to, setTo] = useState((draft?.to ?? []).map((a) => a.address).join(", "));
	const [subject, setSubject] = useState(draft?.subject ?? "");
	const [bodyHtml, setBodyHtml] = useState(draft?.bodyHtml ?? "");
	const [bodyText, setBodyText] = useState(draft?.bodyText ?? "");
	const [scheduledAt, setScheduledAt] = useState("");
	const [attachments, setAttachments] = useState<MailAttachment[]>([]);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (draft?.id && draft.attachmentIds?.length) {
			mailApi.listDraftAttachments(draft.id).then((res) => {
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
				const presign = await mailApi.presignUpload(id, { fileName: file.name, mimeType: file.type || "application/octet-stream", size: file.size });
				if (!presign.success || !presign.data) return;
				const uploaded = await fetch(presign.data.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
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
			const payload: Partial<ComposePayload> = { to: parseAddresses(to), subject, bodyHtml, bodyText, attachmentIds: attachments.map((a) => a.id) };
			if (draftId) await mailApi.updateDraft(draftId, payload);
			else await mailApi.createDraft(payload);
			onClose(false);
		} finally {
			setBusy(false);
		}
	}, [draftId, to, subject, bodyHtml, bodyText, attachments, onClose]);

	const send = useCallback(async () => {
		const recipients = parseAddresses(to);
		if (recipients.length === 0) return;
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
	}, [to, subject, bodyHtml, bodyText, attachments, scheduledAt, draftId, draft, onClose]);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 text-text" role="dialog" aria-modal="true" aria-label={t("compose.title")}>
			<div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded-xl bg-surface p-5 shadow-xl">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold">{t("compose.title")}</h2>
					<button type="button" aria-label={t("actions.close")} onClick={() => onClose(false)}>
						✕
					</button>
				</div>

				<label className="flex flex-col gap-1 text-sm">
					{t("compose.to")}
					<input
						type="text"
						value={to}
						onChange={(e) => setTo(e.target.value)}
						placeholder="alguien@ejemplo.com"
						className="rounded-lg border border-text/15 px-3 py-2"
					/>
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

				<div className="mt-2 flex items-center justify-end gap-2">
					<button type="button" disabled={busy} onClick={saveDraft} className="rounded-lg border border-text/20 px-4 py-2">
						{t("compose.saveDraft")}
					</button>
					<button type="button" disabled={busy} onClick={send} className="rounded-lg bg-primary px-4 py-2 font-medium text-tprimary">
						{scheduledAt ? t("compose.scheduleSend") : t("compose.send")}
					</button>
				</div>
			</div>
		</div>
	);
}
