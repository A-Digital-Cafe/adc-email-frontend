import type { EmailMessage, EmailFolder, EmailAddress } from "@common/types/email/Email.ts";
import type { TFn } from "../types.ts";

interface Props {
	messages: EmailMessage[];
	folder: EmailFolder;
	loading: boolean;
	selectedId?: string;
	onOpen: (message: EmailMessage) => void;
	onDelete: (message: EmailMessage) => void;
	onStar: (message: EmailMessage) => void;
	t: TFn;
}

function formatAddress(folder: EmailFolder, message: EmailMessage): string {
	const list: EmailAddress[] = folder === "sent" || folder === "drafts" ? message.to : [message.from];
	const first = list[0];
	if (!first) return "—";
	const base = first.name || first.address;
	return list.length > 1 ? `${base} +${list.length - 1}` : base;
}

function formatDate(value: string | Date | undefined): string {
	if (!value) return "";
	const d = new Date(value);
	const now = new Date();
	const sameDay = d.toDateString() === now.toDateString();
	return sameDay ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString();
}

export function MessageList({ messages, folder, loading, selectedId, onOpen, onDelete, onStar, t }: Readonly<Props>) {
	if (loading) {
		return (
			<div className="flex flex-col gap-2 p-4" aria-busy="true" aria-label={t("list.loading")}>
				{["s1", "s2", "s3", "s4", "s5", "s6"].map((k) => (
					<adc-skeleton key={k} variant="rectangular" height="56px" />
				))}
			</div>
		);
	}
	if (messages.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center gap-3 p-10 text-center opacity-70">
				<adc-icon-app-mail size="2.5rem" />
				<p>{t("list.empty")}</p>
			</div>
		);
	}
	return (
		<ul className="divide-y divide-text/10">
			{messages.map((message) => {
				const active = message.id === selectedId;
				const unread = !message.read && folder !== "drafts";
				return (
					<li key={message.id} className={`relative ${active ? "bg-alt" : "hover:bg-alt"}`}>
						<button
							type="button"
							aria-label={t("list.open", { subject: message.subject || t("list.noSubject") })}
							onClick={() => onOpen(message)}
							className="absolute inset-0 h-full w-full cursor-pointer"
						/>
						<div className="pointer-events-none relative flex flex-col gap-1 px-4 py-3">
							<div className="flex items-center justify-between gap-2">
								<span className={`truncate ${unread ? "mail-unread" : ""}`}>{formatAddress(folder, message)}</span>
								<span className="shrink-0 text-xs opacity-60">
									{formatDate(message.sentAt || message.receivedAt || message.createdAt)}
								</span>
							</div>
							<div className="flex items-center justify-between gap-2">
								<span className={`truncate text-sm ${unread ? "mail-unread" : "opacity-80"}`}>
									{message.subject || t("list.noSubject")}
								</span>
								<div className="pointer-events-auto relative flex shrink-0 items-center gap-1">
									<button
										type="button"
										aria-label={t("actions.star")}
										aria-pressed={message.starred ? "true" : "false"}
										title={t("actions.star")}
										className={`inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-text/10 ${
											message.starred ? "text-warn" : "text-muted"
										}`}
										onClick={(e) => {
											e.stopPropagation();
											onStar(message);
										}}
									>
										<svg
											width="18"
											height="18"
											viewBox="0 0 24 24"
											fill={message.starred ? "currentColor" : "none"}
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
											aria-hidden="true"
										>
											<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
										</svg>
									</button>
									<button
										type="button"
										aria-label={t("actions.delete")}
										title={t("actions.delete")}
										className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-text/10 hover:text-danger"
										onClick={(e) => {
											e.stopPropagation();
											onDelete(message);
										}}
									>
										<adc-icon-trash size="1rem" />
									</button>
								</div>
							</div>
						</div>
					</li>
				);
			})}
		</ul>
	);
}
