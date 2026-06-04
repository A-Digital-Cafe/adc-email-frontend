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

export function MessageList({ messages, folder, loading, selectedId, onOpen, onDelete, onStar, t }: Props) {
	if (loading) {
		return <div className="p-4 opacity-60">{t("list.loading")}</div>;
	}
	if (messages.length === 0) {
		return <div className="p-4 opacity-60">{t("list.empty")}</div>;
	}
	return (
		<ul className="divide-y divide-text/10">
			{messages.map((message) => {
				const active = message.id === selectedId;
				const unread = !message.read && folder !== "drafts";
				return (
					<li key={message.id}>
						<div
							role="button"
							tabIndex={0}
							onClick={() => onOpen(message)}
							onKeyDown={(e) => e.key === "Enter" && onOpen(message)}
							className={`flex cursor-pointer flex-col gap-1 px-4 py-3 ${active ? "bg-alt" : "hover:bg-alt"}`}
						>
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
								<div className="flex shrink-0 items-center gap-2">
									<button
										type="button"
										aria-label={t("actions.star")}
										onClick={(e) => {
											e.stopPropagation();
											onStar(message);
										}}
									>
										{message.starred ? "★" : "☆"}
									</button>
									<button
										type="button"
										aria-label={t("actions.delete")}
										onClick={(e) => {
											e.stopPropagation();
											onDelete(message);
										}}
									>
										🗑
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
