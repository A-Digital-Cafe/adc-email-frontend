import { useEffect, useId, useRef, useState } from "react";
import type { EmailMessage, EmailFolder, EmailAddress } from "@common/types/email/Email.ts";
import { mailApi, resolveDownloadUrl, type MailAttachment } from "../utils/mail-api.ts";
import { AttachmentPreviewModal, attachmentPreviewKind } from "./AttachmentPreviewModal.tsx";
import type { TFn } from "../types.ts";

interface Props {
	message: EmailMessage;
	folder: EmailFolder;
	onDelete: (message: EmailMessage) => void;
	onStar: (message: EmailMessage) => void;
	onSpam: (message: EmailMessage, spam: boolean) => void;
	/** Sólo en layout compacto: vuelve a la lista (la vista ocupa toda la pantalla). */
	onBack?: () => void;
	t: TFn;
}

/** `spamReason` del backend → clave con la explicación para el usuario. */
const SPAM_REASON_KEYS: Record<string, string> = {
	"blocked:user": "blockedByYou",
	"blocked:global": "blockedByPlatform",
	score: "detected",
};

function addressLine(list: EmailAddress[]): string {
	return list.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(", ");
}

function securityLabel(message: EmailMessage, t: TFn): string {
	const tls = message.transportSecurity;
	if (!tls) return message.authResults ? t("view.details.plain") : t("view.details.internal");
	const detail = [tls.version, tls.cipher].filter(Boolean).join(" · ");
	return detail ? t("view.details.encryptedWith", { detail }) : t("view.details.encrypted");
}

/** Filas del panel de detalles. Sin autenticación del MTA no hay nada que informar de SPF/DKIM. */
function detailRows(message: EmailMessage, t: TFn): Array<[string, string]> {
	const date = message.receivedAt ?? message.sentAt ?? message.createdAt;
	const rows: Array<[string, string]> = [[t("view.details.date"), date ? new Date(date).toLocaleString() : "—"]];
	if (message.direction !== "inbound") return rows;

	const auth = message.authResults;
	if (auth) {
		rows.push([t("view.details.mailedBy"), auth.mailedBy || t(auth.spf === "fail" ? "view.details.spfFail" : "view.details.spfNone")], [t("view.details.signedBy"), auth.signedBy || t(auth.dkim === "fail" ? "view.details.dkimFail" : "view.details.dkimNone")]);
	}
	rows.push([t("view.details.security"), securityLabel(message, t)]);
	return rows;
}

/**
 * Cabecera "De / Para" que despliega los detalles técnicos del mensaje.
 *
 * Se abre por hover sólo con mouse (`pointerType`): en táctil el tap dispara además `pointerenter`,
 * y con el hover activo el segundo tap no podría cerrar el panel. El panel crece en el flujo en vez
 * de flotar porque el panel de lectura es `overflow-y-auto` y le recortaba las últimas filas.
 */
function AddressBlock({ message, t }: Readonly<{ message: EmailMessage; t: TFn }>) {
	const [pinned, setPinned] = useState(false);
	const [hovered, setHovered] = useState(false);
	const wrapper = useRef<HTMLDivElement>(null);
	const panelId = useId();
	const open = pinned || hovered;

	useEffect(() => {
		if (!pinned) return;
		const onPointerDown = (e: PointerEvent) => {
			if (!wrapper.current?.contains(e.target as Node)) setPinned(false);
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setPinned(false);
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [pinned]);

	return (
		<div ref={wrapper} onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)} onPointerLeave={() => setHovered(false)}>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={panelId}
				title={t("view.details.toggle")}
				onClick={() => setPinned((v) => !v)}
				className="flex w-full touch-manipulation items-center gap-2 rounded-md py-1 text-left hover:bg-text/5"
			>
				<span className="min-w-0">
					<span className="block text-sm opacity-70 wrap-break-word">
						{t("view.from")}: {addressLine([message.from])}
					</span>
					<span className="block text-sm opacity-70 wrap-break-word">
						{t("view.to")}: {addressLine(message.to)}
					</span>
				</span>
				<adc-icon-line-arrow-right
					style={{ transform: `rotate(${open ? 270 : 90}deg)`, transition: "transform 0.1s ease" }}
					aria-hidden="true"
				/>
			</button>
			{open && (
				<dl
					id={panelId}
					className="mt-1 max-w-sm rounded-lg border border-text/15 bg-alt p-3 text-sm"
				>
					{detailRows(message, t).map(([label, value]) => (
						<div key={label} className="flex gap-2 py-0.5">
							<dt className="w-28 shrink-0 opacity-70 wrap-break-word">{label}</dt>
							<dd className="min-w-0 flex-1 wrap-break-word">{value}</dd>
						</div>
					))}
				</dl>
			)}
		</div>
	);
}

export function MessageView({ message, folder, onDelete, onStar, onSpam, onBack, t }: Readonly<Props>) {
	const [attachments, setAttachments] = useState<MailAttachment[]>([]);
	const [preview, setPreview] = useState<MailAttachment | null>(null);

	useEffect(() => {
		let active = true;
		if (message.attachmentIds?.length) {
			mailApi.listAttachments(message.id).then((res) => {
				if (active && res.success && res.data) setAttachments(res.data);
			});
		} else {
			setAttachments([]);
		}
		return () => {
			active = false;
		};
	}, [message.id, message.attachmentIds]);

	const download = async (att: MailAttachment) => {
		const res = await mailApi.downloadUrl(att.id);
		if (res.success && res.data?.url) globalThis.open(resolveDownloadUrl(res.data.url), "_blank", "noopener");
	};

	// En `inbox` el botón manda a spam; en `spam` hace lo contrario. En el resto no aplica.
	const showSpamAction = folder === "inbox" || folder === "spam";
	const markingSpam = folder === "inbox";
	const spamLabel = t(markingSpam ? "actions.markSpam" : "actions.notSpam");

	const actions = (
		<div className="flex shrink-0 items-center gap-1">
			<button
				type="button"
				aria-label={t("actions.star")}
				aria-pressed={message.starred ? "true" : "false"}
				onClick={() => onStar(message)}
				className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full hover:bg-text/10"
			>
				{message.starred ? "★" : "☆"}
			</button>
			{showSpamAction && (
				<button
					type="button"
					aria-label={spamLabel}
					title={spamLabel}
					onClick={() => onSpam(message, markingSpam)}
					className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full hover:bg-text/10"
				>
					{markingSpam ? "🚫" : "✅"}
				</button>
			)}
			<button
				type="button"
				aria-label={t("actions.delete")}
				onClick={() => onDelete(message)}
				className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full hover:bg-text/10"
			>
				🗑
			</button>
		</div>
	);

	const meta = (
		<div className="min-w-0 flex-1">
			<h2 className="text-lg font-semibold wrap-break-word">{message.subject || t("list.noSubject")}</h2>
			<AddressBlock message={message} t={t} />
			{message.scheduledAt && (
				<p className="text-sm text-primary">
					{t("view.scheduled")}: {new Date(message.scheduledAt).toLocaleString()}
				</p>
			)}
		</div>
	);

	return (
		<article className="flex min-w-0 flex-col gap-4 p-4 lg:p-6">
			{/* A pantalla completa (compacto) las acciones van en su propia barra: el
			    asunto necesita el ancho entero para no partirse en cinco líneas. */}
			{onBack ? (
				<header className="flex flex-col gap-2">
					<div className="flex items-center justify-between gap-2">
						<button
							type="button"
							aria-label={t("actions.back")}
							title={t("actions.back")}
							onClick={onBack}
							className="-ml-2 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full hover:bg-text/10"
						>
							<adc-icon-line-arrow-right style={{ transform: "rotate(180deg)" }} aria-hidden="true" />
						</button>
						{actions}
					</div>
					{meta}
				</header>
			) : (
				<header className="flex items-start gap-4">
					{meta}
					{actions}
				</header>
			)}

			{folder === "spam" && (
				<adc-callout tone="warning" role="note">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<span className="min-w-0">
							{t(`spam.reason.${SPAM_REASON_KEYS[message.spamReason ?? ""] ?? "unknown"}`)} {t("spam.recover")}
						</span>
						<adc-button
							variant="accent-outlined"
							size="small"
							label={t("actions.notSpam")}
							onClick={() => onSpam(message, false)}
						/>
					</div>
				</adc-callout>
			)}

			<adc-mail-viewer html={message.bodyHtml || ""} />

			{attachments.length > 0 && (
				<section className="flex flex-wrap gap-2 border-t border-text/10 pt-3">
					{attachments.map((att) => {
						const previewable = attachmentPreviewKind(att.mimeType) !== null;
						return (
							<span key={att.id} className="flex max-w-full items-center rounded-lg border border-text/15 text-sm">
								<button
									type="button"
									onClick={() => (previewable ? setPreview(att) : download(att))}
									className="flex min-w-0 items-center gap-2 px-3 py-1.5"
								>
									<span aria-hidden="true">📎</span>
									<span className="truncate">{att.fileName}</span>
								</button>
								{previewable && (
									<button
										type="button"
										aria-label={t("view.download")}
										title={t("view.download")}
										onClick={() => download(att)}
										className="px-2 py-1.5 border-l border-text/15 opacity-70 hover:opacity-100"
									>
										⭳
									</button>
								)}
							</span>
						);
					})}
				</section>
			)}

			{preview && <AttachmentPreviewModal attachment={preview} onClose={() => setPreview(null)} t={t} />}
		</article>
	);
}
