export default {
	nav: {
		title: "Mail",
	},
	auth: {
		title: "Sign in to view your mail",
		subtitle: "You need an active session to access your mailbox.",
	},
	folders: {
		inbox: "Inbox",
		sent: "Sent",
		drafts: "Drafts",
		spam: "Spam",
		trash: "Trash",
	},
	list: {
		loading: "Loading messages…",
		empty: "No messages",
		noSubject: "(no subject)",
		open: "Open message: {{subject}}",
	},
	view: {
		from: "From",
		to: "To",
		scheduled: "Scheduled for",
	},
	actions: {
		star: "Star",
		delete: "Delete",
		close: "Close",
	},
	compose: {
		button: "Compose",
		title: "New message",
		to: "To",
		subject: "Subject",
		bodyPlaceholder: "Write your message…",
		schedule: "Schedule send (optional)",
		send: "Send",
		scheduleSend: "Schedule",
		saveDraft: "Save draft",
	},
	quota: {
		storage: "Storage",
	},
	// Only NON-generic keys (email domain). Generic ones (FORBIDDEN, NO_TOKEN,
	// http.*, attachments…) live in 00-adc-ui-library/i18n.
	errors: {
		MISSING_FIELDS: "Required fields are missing.",
		INVALID_FIELD: "Invalid field.",
		INVALID_ADDRESS: "Invalid email address.",
		INVALID_RECIPIENTS: "Invalid recipients.",
		INVALID_SCHEDULE: "Invalid scheduled send date.",
		MESSAGE_NOT_FOUND: "Message not found.",
		ACCOUNT_NOT_FOUND: "Mail account not found.",
		FOLDER_NOT_FOUND: "Folder not found.",
		QUOTA_EXCEEDED: "You have exceeded your mail quota.",
		STORAGE_FULL: "Mail storage is full.",
		TOO_MANY_RECIPIENTS: "Too many recipients.",
		TOO_MANY_SCHEDULED: "Too many scheduled messages.",
		TRANSPORT_UNAVAILABLE: "The mail service is currently unavailable.",
		ATTACHMENTS_UNAVAILABLE: "Attachments are currently unavailable.",
	},
};
