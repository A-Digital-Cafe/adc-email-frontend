import "@ui-library/utils/react-jsx";
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "@ui-library/utils/i18n-react";
import { getSession } from "@ui-library/utils/session";
import { clearErrors } from "@ui-library/utils/adc-fetch";
import { useIsCompact } from "@ui-library/utils/use-media-query";
import type { EmailMessage, EmailFolder } from "@common/types/email/Email.ts";
import { mailApi, type AccountInfo, type MailSettings } from "./utils/mail-api.ts";
import { MessageList } from "./components/MessageList.tsx";
import { MessageView } from "./components/MessageView.tsx";
import { ComposeModal } from "./components/ComposeModal.tsx";
import { QuotaBanner } from "./components/QuotaBanner.tsx";
import LandingView from "./pages/LandingView.tsx";
import { SettingsMenu } from "./components/SettingsMenu.tsx";

const FOLDERS: EmailFolder[] = ["inbox", "sent", "drafts", "spam", "trash"];

function isFolder(action: string): action is EmailFolder {
	return (FOLDERS as string[]).includes(action);
}

const FOLDER_ICONS: Record<EmailFolder, string> = {
	inbox: `<svg class="w-6 h-6 mx-auto block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z"/></svg>`,
	sent: `<svg class="w-6 h-6 mx-auto block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>`,
	drafts: `<svg class="w-6 h-6 mx-auto block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>`,
	spam: `<svg class="w-6 h-6 mx-auto block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>`,
	trash: `<svg class="w-6 h-6 mx-auto block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.02-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>`,
};

/** Mientras no responda `/settings` (backend viejo, o cuenta nueva) vale lo mismo que el default del servidor. */
const SETTINGS_FALLBACK: MailSettings = { attachmentOverflow: "drive-link", autoMarkRead: true, listDensity: "comfortable" };

export default function App() {
	const { t, ready } = useTranslation({ namespace: "adc-mail", autoLoad: true });
	const [loading, setLoading] = useState(true);
	const [unauthorized, setUnauthorized] = useState(false);
	const [account, setAccount] = useState<AccountInfo | null>(null);
	const [folder, setFolder] = useState<EmailFolder>("inbox");
	const [settings, setSettings] = useState<MailSettings>(SETTINGS_FALLBACK);
	const [messages, setMessages] = useState<EmailMessage[]>([]);
	const [counts, setCounts] = useState<Record<string, number>>({});
	const [selected, setSelected] = useState<EmailMessage | null>(null);
	const [composeOpen, setComposeOpen] = useState(false);
	const [composeDraft, setComposeDraft] = useState<EmailMessage | null>(null);
	const [listLoading, setListLoading] = useState(false);
	const [sidebarExpanded, setSidebarExpanded] = useState(false);
	const sidebarRef = useRef<HTMLElement>(null);
	const layoutRef = useRef<HTMLElement>(null);
	// Por debajo de `lg` no hay espacio para lista + lectura en paralelo: la lista
	// ocupa el ancho completo y el mensaje se abre en un modal a pantalla completa.
	const compact = useIsCompact();
	const [sidebarOffset, setSidebarOffset] = useState(0);

	const loadCounts = useCallback(async () => {
		const entries = await Promise.all(
			FOLDERS.map(async (f) => {
				const res = await mailApi.folderCount(f);
				return [f, res.success && res.data ? res.data.unread : 0] as const;
			})
		);
		setCounts(Object.fromEntries(entries));
	}, []);

	const loadFolder = useCallback(async (target: EmailFolder) => {
		setListLoading(true);
		setSelected(null);
		const res = await mailApi.listFolder(target, { limit: 50 });
		if (res.success && res.data) setMessages(res.data.messages);
		else setMessages([]);
		setListLoading(false);
	}, []);

	const init = useCallback(async () => {
		setLoading(true);
		clearErrors();
		const session = await getSession(true);
		if (!session.authenticated || !session.user) {
			setUnauthorized(true);
			setLoading(false);
			return;
		}
		const [acc, prefs] = await Promise.all([mailApi.getAccount(), mailApi.getSettings()]);
		if (acc.success && acc.data) setAccount(acc.data);
		if (prefs.success && prefs.data) setSettings(prefs.data);
		await loadFolder("inbox");
		await loadCounts();
		setLoading(false);
	}, [loadFolder, loadCounts]);

	useEffect(() => {
		init();
	}, [init]);

	const handleSidebarItemClick = useCallback(
		(e: Event) => {
			const action = (e as CustomEvent).detail?.action as string | undefined;
			if (!action) return;
			setSidebarExpanded(false);
			if (!isFolder(action)) return;
			setFolder(action);
			loadFolder(action);
		},
		[loadFolder]
	);

	const handleMobileMenuToggle = useCallback((e: Event) => {
		setSidebarExpanded(!!(e as CustomEvent).detail);
	}, []);

	useEffect(() => {
		if (!ready || loading || unauthorized) return;
		const sidebar = sidebarRef.current;
		// El evento del botón del header burbujea hasta `adc-layout`.
		const layout = layoutRef.current;
		sidebar?.addEventListener("adcSidebarItemClick", handleSidebarItemClick);
		layout?.addEventListener("adcMobileMenuToggle", handleMobileMenuToggle);
		return () => {
			sidebar?.removeEventListener("adcSidebarItemClick", handleSidebarItemClick);
			layout?.removeEventListener("adcMobileMenuToggle", handleMobileMenuToggle);
		};
	}, [ready, loading, unauthorized, handleSidebarItemClick, handleMobileMenuToggle]);

	// El aside de `adc-sidebar` es `w-max`: su ancho depende del rótulo más largo
	// (y del idioma), así que un offset fijo en rem lo tapa o deja un hueco. Se
	// mide el elemento real y se sigue midiendo si cambia (rotar, cambiar idioma).
	useEffect(() => {
		if (compact || !ready || loading || unauthorized) return;
		const host = sidebarRef.current;
		if (!host) return;
		let observer: ResizeObserver | undefined;
		let cancelled = false;
		// `componentOnReady`: el aside es DOM ligero que Stencil pinta después de
		// hidratar, así que buscarlo en el mismo tick devuelve null.
		(host as HTMLElement & { componentOnReady?: () => Promise<unknown> }).componentOnReady?.().then(() => {
			const aside = host.querySelector("aside");
			if (cancelled || !aside) return;
			observer = new ResizeObserver(() => setSidebarOffset(aside.getBoundingClientRect().width));
			observer.observe(aside);
		});
		return () => {
			cancelled = true;
			observer?.disconnect();
		};
	}, [compact, ready, loading, unauthorized]);

	const handleOpenMessage = useCallback(
		async (message: EmailMessage) => {
			const res = await mailApi.getMessage(message.id);
			const full = res.success && res.data ? res.data : message;
			// Un borrador se edita: abrir además la vista de lectura dejaría dos
			// capas superpuestas (en compacto, dos pantallas completas).
			if (full.folder === "drafts") {
				setComposeDraft(full);
				setComposeOpen(true);
				return;
			}
			setSelected(full);
			if (!full.read && settings.autoMarkRead) {
				await mailApi.setRead(full.id, true);
				setMessages((prev) => prev.map((m) => (m.id === full.id ? { ...m, read: true } : m)));
				loadCounts();
			}
		},
		[loadCounts, settings.autoMarkRead]
	);

	const handleCloseSelected = useCallback(() => setSelected(null), []);

	// Confirmación de vaciado: sólo la carpeta pedida, para que cerrar el modal no deje un "sí"
	// colgado apuntando a otra carpeta si el usuario cambió de carpeta mientras decidía.
	const [emptying, setEmptying] = useState<"spam" | "trash" | null>(null);
	const [emptyBusy, setEmptyBusy] = useState(false);

	const confirmEmptyFolder = useCallback(async () => {
		const target = emptying;
		if (!target || emptyBusy) return;
		setEmptyBusy(true);
		// El backend vacía de a lotes y avisa cuánto quedó: se repite hasta terminar en vez de
		// pedirle una sola request enorme que bloquee el worker.
		for (;;) {
			const res = await mailApi.emptyFolder(target);
			if (!res.success || !res.data || res.data.remaining === 0) break;
		}
		setEmptyBusy(false);
		setEmptying(null);
		setSelected(null);
		await loadFolder(target);
		await loadCounts();
	}, [emptying, emptyBusy, loadFolder, loadCounts]);

	const handleDelete = useCallback(
		async (message: EmailMessage) => {
			await mailApi.remove(message.id);
			setMessages((prev) => prev.filter((m) => m.id !== message.id));
			if (selected?.id === message.id) setSelected(null);
			loadCounts();
		},
		[selected, loadCounts]
	);

	// El mensaje cambia de carpeta, así que sale de la lista actual sea cual sea el sentido.
	const handleSpam = useCallback(
		async (message: EmailMessage, spam: boolean) => {
			const res = await mailApi.reportSpam(message.id, spam);
			if (!res.success) return;
			setMessages((prev) => prev.filter((m) => m.id !== message.id));
			if (selected?.id === message.id) setSelected(null);
			loadCounts();
		},
		[selected, loadCounts]
	);

	const handleStar = useCallback(async (message: EmailMessage) => {
		const next = !message.starred;
		await mailApi.setStarred(message.id, next);
		setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, starred: next } : m)));
		setSelected((prev) => (prev?.id === message.id ? { ...prev, starred: next } : prev));
	}, []);

	const handleCompose = useCallback(() => {
		setComposeDraft(null);
		setComposeOpen(true);
	}, []);

	const handleComposeClose = useCallback(
		(didSend: boolean) => {
			setComposeOpen(false);
			setComposeDraft(null);
			if (didSend || folder === "drafts") {
				loadFolder(folder);
				loadCounts();
			}
		},
		[folder, loadFolder, loadCounts]
	);

	if (!ready || loading) {
		return (
			<adc-layout>
				<div className="flex h-screen items-center justify-center">
					<adc-skeleton style={{ width: "320px", height: "200px" }} />
				</div>
			</adc-layout>
		);
	}

	if (unauthorized) {
		return (
			<adc-layout>
				{/* Mismo `div` envolvente que las otras ramas: `adc-layout` reubica sus slotted children,
				    así que cambiar el TIPO del hijo directo entre renders hace fallar el removeChild de
				    React y se desmonta el árbol entero. Ver docs/architecture/ui-federation.md. */}
				<div className="flex min-h-screen flex-col">
					<LandingView />
				</div>
			</adc-layout>
		);
	}

	const sidebarItems = FOLDERS.map((f) => ({
		label: t(`folders.${f}`),
		iconSvg: FOLDER_ICONS[f],
		action: f as string,
		badge: counts[f] ? String(counts[f]) : undefined,
	}));

	return (
		// `fullWidth`: sin él el contenedor de `adc-layout` es `xl:w-max` (se ajusta al
		// contenido), así que una línea larga de un correo ensancha la página entera.
		// `mobile-menu`: en mobile el logo del header abre el drawer de carpetas.
		<adc-layout ref={layoutRef} fullWidth mobile-menu mobile-menu-open={sidebarExpanded || undefined} mobile-menu-label={t("nav.menu")}>
			<div className="flex bg-background">
				{/* Dentro del wrapper y no como hermano de `adc-layout`: reubica sus slotted children y
				    con más de uno React pierde la referencia del hermano (`insertBefore`). El modal es
				    fijo, así que colgar de acá no cambia dónde se ve. */}
				<SettingsMenu t={t} settings={settings} onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))} />

				{/* Backdrop del drawer: en mobile el sidebar se superpone al contenido. */}
				{sidebarExpanded && (
					<button
						type="button"
						aria-label={t("actions.close")}
						className="fixed inset-0 z-10 bg-black/40 lg:hidden"
						onClick={() => setSidebarExpanded(false)}
					/>
				)}

				<adc-sidebar ref={sidebarRef} items={sidebarItems} collapsed={!sidebarExpanded} activeItem={folder} title={t("nav.title")}>
					<button
						slot="actions"
						type="button"
						onClick={handleCompose}
						className="flex min-w-16 min-h-16 lg:min-h-0 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 font-lg text-tprimary"
					>
						<span aria-hidden="true">✉️</span>
						<span
							className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
								sidebarExpanded ? "max-w-40 opacity-100" : "hidden max-w-0 opacity-0"
							} lg:max-w-40 lg:opacity-100 lg:inline`}
						>
							{t("compose.button")}
						</span>
					</button>
				</adc-sidebar>

				<main className="min-w-0 flex-1">
					{/* Despeja el aside fixed para que sidebar | lista | vista queden en horizontal sin
					    solaparse: `lg:pl-70` (la convención de adc-page-shell) es el valor de arranque y
					    el ancho medido lo corrige. En mobile el aside es un drawer superpuesto, así que
					    sólo aplica el padding base. */}
					<div className="pl-4 lg:pl-70" style={!compact && sidebarOffset ? { paddingLeft: sidebarOffset } : undefined}>
						{account && <QuotaBanner account={account} t={t} />}
						<div className="flex min-h-0">
							<div className="w-full min-w-0 overflow-y-auto lg:max-w-md lg:border-r lg:border-text/10">
								<MessageList
									messages={messages}
									folder={folder}
									loading={listLoading}
									selectedId={selected?.id}
									onOpen={handleOpenMessage}
									onDelete={handleDelete}
									onStar={handleStar}
									onEmptyFolder={folder === "spam" || folder === "trash" ? () => setEmptying(folder) : undefined}
									density={settings.listDensity}
									t={t}
								/>
							</div>

							{/* En compacto la lectura vive en el modal de abajo, no en un panel lateral.
								    `min-w-0`: sin eso el flex item se ensancha hasta el contenido (un correo
								    con líneas largas) y la página entera desborda en horizontal. */}
							{!compact && (
								<div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
									{selected ? (
										<MessageView
											message={selected}
											folder={folder}
											onDelete={handleDelete}
											onStar={handleStar}
											onSpam={handleSpam}
											t={t}
										/>
									) : (
										<div className="flex h-full items-center justify-center opacity-50">{t("view.noSelection")}</div>
									)}
								</div>
							)}
						</div>
					</div>
				</main>
				{compact && selected && (
					<adc-modal open size="full" hideChrome modalTitle={selected.subject || t("list.noSubject")} onadcClose={handleCloseSelected}>
						<MessageView
							message={selected}
							folder={folder}
							onDelete={handleDelete}
							onStar={handleStar}
							onSpam={handleSpam}
							onBack={handleCloseSelected}
							t={t}
						/>
					</adc-modal>
				)}
				{composeOpen && <ComposeModal draft={composeDraft} policy={account?.policy ?? null} onClose={handleComposeClose} t={t} />}

				<adc-modal
					open={!!emptying}
					size="sm"
					modalTitle={t(emptying === "trash" ? "list.emptyTrashAction" : "list.emptySpamAction")}
					onadcClose={() => !emptyBusy && setEmptying(null)}
				>
					<p className="text-sm">{t(emptying === "trash" ? "list.emptyTrashConfirm" : "list.emptySpamConfirm")}</p>
					<div slot="footer" className="flex gap-2">
						<adc-button
							variant="accent-outlined"
							size="small"
							label={t("actions.cancel")}
							disabled={emptyBusy}
							onClick={() => setEmptying(null)}
						/>
						<adc-button
							variant="danger"
							size="small"
							label={t("actions.confirmEmpty")}
							loading={emptyBusy}
							onClick={confirmEmptyFolder}
						/>
					</div>
				</adc-modal>
			</div>
		</adc-layout>
	);
}
