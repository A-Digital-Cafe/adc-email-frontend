import { createAdcApi } from "@ui-library/utils/adc-fetch";
import { IS_DEV, getDevUrl } from "@common/utils/url-utils.js";
import type { EmailMessage, MailAccount, EmailFolder } from "@common/types/email/Email.ts";
import type { EmailUserTierLimits, EmailOrgTierLimits } from "@common/types/tiers/email.ts";

const api = createAdcApi({
	basePath: "/api/email",
	devPort: 3000,
	credentials: process.env.NODE_ENV === "development" ? "include" : "same-origin",
});

/**
 * Las URLs de descarga pueden ser absolutas (S3 presignado) o relativas a la
 * plataforma (adjuntos cifrados servidos por el backend). Las relativas se
 * resuelven contra el origen del API (en dev, puerto 3000).
 */
export function resolveDownloadUrl(url: string): string {
	if (!url.startsWith("/")) return url;
	return IS_DEV ? getDevUrl(3000, url) : url;
}

/**
 * Payload de composición tal como lo maneja la UI: los destinatarios son
 * strings sueltos. La API los exige como objetos `{ address }`, así que la
 * conversión se hace acá (`#withAddresses`) y no en cada componente.
 */
export interface ComposePayload {
	to: string[];
	cc?: string[];
	bcc?: string[];
	subject: string;
	bodyHtml: string;
	bodyText?: string;
	attachmentIds?: string[];
	inReplyTo?: string;
	threadId?: string;
	scheduledAt?: string;
}

export interface FolderCount {
	folder: EmailFolder;
	total: number;
	unread: number;
}

/**
 * Política de entrega del servidor. Con `internalOnly` sólo se puede enviar a
 * buzones de la plataforma (`rootDomain` y sus subdominios de organización);
 * recibir correo de fuera sigue funcionando.
 */
export interface MailPolicy {
	internalOnly: boolean;
	rootDomain: string;
}

export interface AccountInfo {
	policy: MailPolicy;
	account: MailAccount;
	scope: "user" | "org";
	orgStorageUsedBytes: number;
	userLimits: EmailUserTierLimits;
	orgLimits: EmailOrgTierLimits;
}

export interface PresignResult {
	attachmentId: string;
	uploadUrl: string;
	/** Cabeceras obligatorias del PUT: algunas van firmadas, se mandan tal cual. */
	headers: Record<string, string>;
	fields?: Record<string, string>;
}

export interface MailAttachment {
	id: string;
	fileName: string;
	mimeType: string;
	size: number;
	status: string;
}

/** Convierte los destinatarios de string a `{ address }`, que es lo que valida la API. */
function withAddresses(data: Partial<ComposePayload>): Record<string, unknown> {
	const toObjects = (list?: string[]) => list?.map((address) => ({ address }));
	const mapped: Record<string, unknown> = { ...data };
	for (const field of ["to", "cc", "bcc"] as const) {
		if (data[field]) mapped[field] = toObjects(data[field]);
	}
	return mapped;
}

export const mailApi = {
	// `silent`: en una cuenta nueva/vacía estos endpoints devuelven 404 esperados.
	// Sin silenciar, cada uno dispara un toast global ("Recurso no encontrado") y
	// loadCounts() encadena 5 a la vez. El fallback (null/[]/0) ya cubre el caso.
	getAccount: () => api.get<AccountInfo>("/account", { silent: true }),

	listFolder: (folder: EmailFolder, params?: { limit?: number; skip?: number; unread?: string; q?: string }) =>
		api.get<{ folder: EmailFolder; messages: EmailMessage[] }>(`/folders/${folder}/messages`, { params, silent: true }),

	folderCount: (folder: EmailFolder) => api.get<FolderCount>(`/folders/${folder}/count`, { silent: true }),

	getMessage: (id: string) => api.get<EmailMessage>(`/messages/${id}`),

	setRead: (id: string, read: boolean) => api.patch<EmailMessage>(`/messages/${id}/read`, { body: { read } }),

	setStarred: (id: string, starred: boolean) => api.patch<EmailMessage>(`/messages/${id}/star`, { body: { starred } }),

	move: (id: string, folder: EmailFolder) => api.patch<EmailMessage>(`/messages/${id}/move`, { body: { folder } }),

	remove: (id: string) => api.delete<{ ok: boolean; purged: boolean }>(`/messages/${id}`),

	listDrafts: () => api.get<{ folder: EmailFolder; messages: EmailMessage[] }>("/drafts"),

	// Crea un documento nuevo por llamada: mantiene idempotencia para que un reintento
	// de red no deje dos borradores. `t` la hace única por invocación intencional.
	createDraft: (data: Partial<ComposePayload>) =>
		api.post<EmailMessage>("/drafts", { body: withAddresses(data), idempotencyData: { action: "create-draft", t: Date.now() } }),

	updateDraft: (id: string, data: Partial<ComposePayload>) => api.put<EmailMessage>(`/drafts/${id}`, { body: withAddresses(data) }),

	send: (data: ComposePayload) =>
		api.post<{ id: string; status: string; scheduledAt?: string }>("/send", {
			body: withAddresses(data),
			idempotencyData: data,
		}),

	listDraftAttachments: (draftId: string) => api.get<MailAttachment[]>(`/drafts/${draftId}/attachments`),

	// Cada presign registra un adjunto nuevo; subir dos veces el mismo archivo es
	// legítimo, así que la clave se distingue por invocación.
	presignUpload: (draftId: string, file: { fileName: string; mimeType: string; size: number }) =>
		api.post<PresignResult>("/attachments/presign-upload", {
			body: { draftId, ...file },
			idempotencyData: { action: "presign-upload", draftId, ...file, t: Date.now() },
		}),

	// Clave determinista a propósito: el endpoint suma `att.size` al almacenamiento
	// en cada confirm, así que un reintento debe replayear la respuesta cacheada en
	// vez de volver a contar la cuota.
	confirmUpload: (attachmentId: string) =>
		api.post<MailAttachment>(`/attachments/${attachmentId}/confirm`, {
			idempotencyData: { action: "confirm-upload", attachmentId },
		}),

	downloadUrl: (attachmentId: string) => api.get<{ url: string }>(`/attachments/${attachmentId}/download`),

	deleteAttachment: (attachmentId: string) => api.delete<{ ok: boolean }>(`/attachments/${attachmentId}`),
};
