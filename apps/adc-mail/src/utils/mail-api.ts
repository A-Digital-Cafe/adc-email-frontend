import { createAdcApi } from "@ui-library/utils/adc-fetch";
import { IS_DEV, getDevUrl } from "@common/utils/url-utils.js";
import type {
	EmailMessage,
	MailAccount,
	EmailFolder,
	SpamMatchType,
	SpamRuleKind,
	SpamRuleScope,
	AttachmentOverflowPolicy,
	MailListDensity,
} from "@common/types/email/Email.ts";
import type { EmailUserTierLimits, EmailOrgTierLimits } from "@common/types/tiers/email.ts";

const api = createAdcApi({
	basePath: "/api/email",
	devPort: 3000,
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

/** Regla de remitente tal como la devuelve la API: fechas en ISO y sin el dueño. */
export interface SenderRule {
	id: string;
	scope: SpamRuleScope;
	kind: SpamRuleKind;
	matchType: SpamMatchType;
	/** Ya normalizado por el servidor (minúsculas, sin subaddressing). */
	value: string;
	reason: string;
	createdBy: string;
	createdAt: string;
	expiresAt: string | null;
}

/** Alta de regla. El servidor valida y normaliza `value`, así que acá va tal cual lo tipeado. */
export interface AddRuleInput {
	matchType: SpamMatchType;
	value: string;
	kind: SpamRuleKind;
	reason?: string;
	expiresAt?: string | null;
}

/** Preferencias del buzón tal como las expone la API (sin `userId` ni marca de tiempo). */
export interface MailSettings {
	attachmentOverflow: AttachmentOverflowPolicy;
	autoMarkRead: boolean;
	listDensity: MailListDensity;
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

	// Trabaja de a lotes: `remaining > 0` significa que quedó carpeta por vaciar (ver el bucle en App).
	emptyFolder: (folder: "spam" | "trash") =>
		api.delete<{ folder: EmailFolder; deleted: number; remaining: number }>(`/folders/${folder}/messages`),

	setRead: (id: string, read: boolean) => api.patch<EmailMessage>(`/messages/${id}/read`, { body: { read } }),

	setStarred: (id: string, starred: boolean) => api.patch<EmailMessage>(`/messages/${id}/star`, { body: { starred } }),

	move: (id: string, folder: EmailFolder) => api.patch<EmailMessage>(`/messages/${id}/move`, { body: { folder } }),

	remove: (id: string) => api.delete<{ ok: boolean; purged: boolean }>(`/messages/${id}`),

	// Sin clave de idempotencia: fija un veredicto sobre un mensaje que ya existe, así que
	// repetirlo es el mismo estado (el endpoint declara `skipIdempotency`).
	reportSpam: (id: string, spam: boolean, block?: boolean) =>
		api.post<EmailMessage>(`/messages/${id}/spam`, { body: { spam, ...(block === undefined ? {} : { block }) } }),

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

	// Sirve para un borrador y para un correo recibido: la lista sale del propio mensaje.
	listAttachments: (messageId: string) => api.get<MailAttachment[]>(`/messages/${messageId}/attachments`),

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

	// `limit` es el tope de reglas del plan, no la paginación.
	listBlocklist: () => api.get<{ rules: SenderRule[]; limit: number }>("/blocklist"),

	// `silent`: el 409 (ya está en la lista) y el 413 (tope del plan) son respuestas esperadas del
	// formulario y se muestran junto al campo, no como toast global. Sin clave de idempotencia:
	// el propio 409 ya evita el duplicado de un reintento.
	addBlocklistRule: (input: AddRuleInput) => api.post<SenderRule>("/blocklist", { body: input, silent: true }),

	removeBlocklistRule: (id: string) => api.delete<{ ok: boolean }>(`/blocklist/${id}`),

	// `silent`: la app arranca leyendo preferencias y un backend viejo (sin el endpoint) tiene que
	// caer a los defaults sin gritarle al usuario.
	getSettings: () => api.get<MailSettings>("/settings", { silent: true }),

	// Sin clave de idempotencia: es un `$set` por usuario, reintentar deja el mismo estado.
	updateSettings: (patch: Partial<MailSettings>) => api.patch<MailSettings>("/settings", { body: patch }),
};
