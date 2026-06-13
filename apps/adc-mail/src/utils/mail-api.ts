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

export interface AccountInfo {
	account: MailAccount;
	scope: "user" | "org";
	orgStorageUsedBytes: number;
	userLimits: EmailUserTierLimits;
	orgLimits: EmailOrgTierLimits;
}

export interface PresignResult {
	attachmentId: string;
	uploadUrl: string;
	fields?: Record<string, string>;
}

export interface MailAttachment {
	id: string;
	fileName: string;
	mimeType: string;
	size: number;
	status: string;
}

export const mailApi = {
	getAccount: () => api.get<AccountInfo>("/account"),

	listFolder: (folder: EmailFolder, params?: { limit?: number; skip?: number; unread?: string; q?: string }) =>
		api.get<{ folder: EmailFolder; messages: EmailMessage[] }>(`/folders/${folder}/messages`, { params }),

	folderCount: (folder: EmailFolder) => api.get<FolderCount>(`/folders/${folder}/count`),

	getMessage: (id: string) => api.get<EmailMessage>(`/messages/${id}`),

	setRead: (id: string, read: boolean) => api.patch<EmailMessage>(`/messages/${id}/read`, { body: { read } }),

	setStarred: (id: string, starred: boolean) => api.patch<EmailMessage>(`/messages/${id}/star`, { body: { starred } }),

	move: (id: string, folder: EmailFolder) => api.patch<EmailMessage>(`/messages/${id}/move`, { body: { folder } }),

	remove: (id: string) => api.delete<{ ok: boolean; purged: boolean }>(`/messages/${id}`),

	listDrafts: () => api.get<{ folder: EmailFolder; messages: EmailMessage[] }>("/drafts"),

	createDraft: (data: Partial<ComposePayload>) => api.post<EmailMessage>("/drafts", { body: data }),

	updateDraft: (id: string, data: Partial<ComposePayload>) => api.put<EmailMessage>(`/drafts/${id}`, { body: data }),

	send: (data: ComposePayload) =>
		api.post<{ id: string; status: string; scheduledAt?: string }>("/send", {
			body: data,
			idempotencyData: data,
		}),

	listDraftAttachments: (draftId: string) => api.get<MailAttachment[]>(`/drafts/${draftId}/attachments`),

	presignUpload: (draftId: string, file: { fileName: string; mimeType: string; size: number }) =>
		api.post<PresignResult>("/attachments/presign-upload", { body: { draftId, ...file } }),

	confirmUpload: (attachmentId: string) => api.post<MailAttachment>(`/attachments/${attachmentId}/confirm`),

	downloadUrl: (attachmentId: string) => api.get<{ url: string }>(`/attachments/${attachmentId}/download`),

	deleteAttachment: (attachmentId: string) => api.delete<{ ok: boolean }>(`/attachments/${attachmentId}`),
};
