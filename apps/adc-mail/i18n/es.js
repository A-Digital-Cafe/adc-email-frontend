export default {
	nav: {
		title: "Correo",
	},
	auth: {
		title: "Inicia sesión para ver tu correo",
		subtitle: "Necesitas una sesión activa para acceder a tu buzón.",
	},
	folders: {
		inbox: "Bandeja de entrada",
		sent: "Enviados",
		drafts: "Borradores",
		spam: "Spam",
		trash: "Papelera",
	},
	list: {
		loading: "Cargando mensajes…",
		empty: "No hay mensajes",
		noSubject: "(sin asunto)",
	},
	view: {
		from: "De",
		to: "Para",
		scheduled: "Programado para",
	},
	actions: {
		star: "Destacar",
		delete: "Eliminar",
		close: "Cerrar",
	},
	compose: {
		button: "Redactar",
		title: "Nuevo mensaje",
		to: "Para",
		subject: "Asunto",
		bodyPlaceholder: "Escribe tu mensaje…",
		schedule: "Programar envío (opcional)",
		send: "Enviar",
		scheduleSend: "Programar",
		saveDraft: "Guardar borrador",
	},
	quota: {
		storage: "Almacenamiento",
	},
	// Solo claves NO genéricas (dominio email). Las genéricas (FORBIDDEN, NO_TOKEN,
	// http.*, adjuntos…) viven en 00-adc-ui-library/i18n.
	errors: {
		MISSING_FIELDS: "Faltan campos obligatorios.",
		INVALID_FIELD: "Campo inválido.",
		INVALID_ADDRESS: "Dirección de correo inválida.",
		INVALID_RECIPIENTS: "Destinatarios inválidos.",
		INVALID_SCHEDULE: "Fecha de envío programada inválida.",
		MESSAGE_NOT_FOUND: "Mensaje no encontrado.",
		ACCOUNT_NOT_FOUND: "Cuenta de correo no encontrada.",
		FOLDER_NOT_FOUND: "Carpeta no encontrada.",
		QUOTA_EXCEEDED: "Has superado tu cuota de correo.",
		STORAGE_FULL: "Almacenamiento de correo lleno.",
		TOO_MANY_RECIPIENTS: "Demasiados destinatarios.",
		TOO_MANY_SCHEDULED: "Demasiados envíos programados.",
		TRANSPORT_UNAVAILABLE: "El servicio de correo no está disponible en este momento.",
		ATTACHMENTS_UNAVAILABLE: "Los adjuntos no están disponibles en este momento.",
	},
};
