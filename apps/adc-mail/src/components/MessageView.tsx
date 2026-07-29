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
	t: TFn;
}

function addressLine(list: EmailAddress[]): string {
	return list.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(", ");
}

export function MessageView({ message, onDelete, onStar, t }: Readonly<Props>) {
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

	return (
		<article className="flex flex-col gap-4 p-6">
			<header className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<h2 className="text-lg font-semibold">{message.subject || t("list.noSubject")}</h2>
					<p className="text-sm opacity-70">
						{t("view.from")}: {addressLine([message.from])}
					</p>
					<p className="text-sm opacity-70">
						{t("view.to")}: {addressLine(message.to)}
					</p>
					{message.scheduledAt && (
						<p className="text-sm text-primary">
							{t("view.scheduled")}: {new Date(message.scheduledAt).toLocaleString()}
						</p>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<button type="button" aria-label={t("actions.star")} onClick={() => onStar(message)}>
						{message.starred ? "★" : "☆"}
					</button>
					<button type="button" aria-label={t("actions.delete")} onClick={() => onDelete(message)}>
						🗑
					</button>
				</div>
			</header>

			<adc-mail-viewer html={message.bodyHtml || ""} />

			{attachments.length > 0 && (
				<section className="flex flex-wrap gap-2 border-t border-text/10 pt-3">
					{attachments.map((att) => {
						const previewable = attachmentPreviewKind(att.mimeType) !== null;
						return (
							<span key={att.id} className="flex items-center rounded-lg border border-text/15 text-sm">
								<button
									type="button"
									onClick={() => (previewable ? setPreview(att) : download(att))}
									className="flex items-center gap-2 px-3 py-1.5"
								>
									<span aria-hidden="true">📎</span>
									{att.fileName}
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
