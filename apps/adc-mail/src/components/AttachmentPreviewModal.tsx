import { useEffect, useState } from "react";
import { useIsCompact } from "@ui-library/utils/use-media-query";
import { mailApi, resolveDownloadUrl, type MailAttachment } from "../utils/mail-api.ts";
import type { TFn } from "../types.ts";

interface Props {
	attachment: MailAttachment;
	onClose: () => void;
	t: TFn;
}

type PreviewKind = "image" | "video" | "audio" | "pdf" | "text";

/** Tipo de preview soportado según el mime del adjunto, o `null` (solo descarga). */
export function attachmentPreviewKind(mimeType: string): PreviewKind | null {
	if (mimeType.startsWith("image/")) return "image";
	if (mimeType.startsWith("video/")) return "video";
	if (mimeType.startsWith("audio/")) return "audio";
	if (mimeType === "application/pdf") return "pdf";
	if (mimeType.startsWith("text/")) return "text";
	return null;
}

/**
 * Preview inline de adjuntos de correo con los visores de media-ui-library.
 * Los adjuntos van cifrados por usuario: se bajan vía el proxy descifrante
 * (con cookie de sesión) a un blob y el visor recibe el object URL.
 */
export function AttachmentPreviewModal({ attachment, onClose, t }: Readonly<Props>) {
	const [objectUrl, setObjectUrl] = useState<string | null>(null);
	const [text, setText] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	const kind = attachmentPreviewKind(attachment.mimeType);
	const compact = useIsCompact();

	useEffect(() => {
		let cancelled = false;
		let createdUrl: string | null = null;
		const load = async () => {
			const res = await mailApi.downloadUrl(attachment.id);
			if (!res.success || !res.data?.url) throw new Error("no-url");
			const response = await fetch(resolveDownloadUrl(res.data.url), { credentials: "include" });
			if (!response.ok) throw new Error(`http-${response.status}`);
			if (kind === "text") {
				const content = await response.text();
				if (!cancelled) setText(content);
				return;
			}
			const blob = await response.blob();
			createdUrl = URL.createObjectURL(blob);
			if (!cancelled) setObjectUrl(createdUrl);
		};
		load().catch(() => {
			if (!cancelled) setFailed(true);
		});
		return () => {
			cancelled = true;
			if (createdUrl) URL.revokeObjectURL(createdUrl);
		};
	}, [attachment.id, kind]);

	let body: React.ReactNode;
	if (failed || !kind) {
		body = <p className="text-danger text-sm py-8 text-center">{t("view.previewError")}</p>;
	} else if (kind === "text") {
		body =
			text === null ? (
				<adc-skeleton variant="rectangular" height="280px" />
			) : (
				<pre className="whitespace-pre-wrap font-mono text-sm text-text max-h-[70vh] overflow-y-auto">{text}</pre>
			);
	} else if (objectUrl === null) {
		body = <adc-skeleton variant="rectangular" height="280px" />;
	} else if (kind === "pdf") {
		body = (
			<adc-pdf-viewer
				src={objectUrl}
				fileName={attachment.fileName}
				fallbackLabel={t("view.pdfFallback")}
				downloadLabel={t("view.download")}
			/>
		);
	} else {
		body = <adc-media-viewer src={objectUrl} mediaType={kind} fileName={attachment.fileName} errorLabel={t("view.previewError")} />;
	}

	return (
		<adc-modal open modalTitle={attachment.fileName} size={compact ? "full" : "lg2"} onadcClose={onClose}>
			<div className="flex flex-col gap-3 p-2">{body}</div>
		</adc-modal>
	);
}
