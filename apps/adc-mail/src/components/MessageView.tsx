import { useEffect, useState } from "react";
import type { EmailMessage, EmailFolder, EmailAddress } from "@common/types/email/Email.ts";
import { mailApi, resolveDownloadUrl, type MailAttachment } from "../utils/mail-api.ts";
import { AttachmentPreviewModal, attachmentPreviewKind } from "./AttachmentPreviewModal.tsx";
import type { TFn } from "../types.ts";

interface Props {
	message: EmailMessage;
	folder: EmailFolder;
	onDelete: (message: EmailMessage) => void;
	onStar: (message: EmailMessage) => void;
	/** Sólo en layout compacto: vuelve a la lista (la vista ocupa toda la pantalla). */
	onBack?: () => void;
	t: TFn;
}

function addressLine(list: EmailAddress[]): string {
	return list.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(", ");
}

export function MessageView({ message, onDelete, onStar, onBack, t }: Readonly<Props>) {
	const [attachments, setAttachments] = useState<MailAttachment[]>([]);
	const [preview, setPreview] = useState<MailAttachment | null>(null);

	useEffect(() => {
		let active = true;
		if (message.attachmentIds?.length) {
			mailApi.listDraftAttachments(message.id).then((res) => {
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
			<p className="text-sm opacity-70 wrap-break-word">
				{t("view.from")}: {addressLine([message.from])}
			</p>
			<p className="text-sm opacity-70 wrap-break-word">
				{t("view.to")}: {addressLine(message.to)}
			</p>
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
