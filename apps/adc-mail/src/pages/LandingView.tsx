import "@ui-library/utils/react-jsx";
import { useTranslation } from "@ui-library/utils/i18n-react";
import { goToLogin } from "@ui-library/utils/session";

const FEATURES = [
	{ key: "mailboxes", icon: "📥" },
	{ key: "compose", icon: "✍️" },
	{ key: "attachments", icon: "📎" },
	{ key: "domain", icon: "🏷️" },
] as const;

/** Presentación de Correo para quien todavía no inició sesión. */
export default function LandingView() {
	const { t } = useTranslation({ namespace: "adc-mail", autoLoad: true });

	return (
		<div className="max-w-6xl mx-auto px-4 py-12">
			<section className="flex flex-col items-center text-center" aria-label={t("landing.heroAria")}>
				<adc-icon-app-mail size="3rem" />
				<h1 className="text-3xl sm:text-4xl font-heading font-bold text-text mb-4 mt-3">{t("landing.title")}</h1>
				<p className="text-muted max-w-2xl mb-6">{t("landing.subtitle")}</p>
			</section>

			<section className="grid gap-4 grid-cols-2 mt-12" aria-label={t("landing.featuresAria")}>
				{FEATURES.map(({ key, icon }) => (
					<adc-feature-card key={key} title={t(`landing.features.${key}.title`)}>
						<span slot="icon" aria-hidden="true" className="text-3xl">
							{icon}
						</span>
						<span>{t(`landing.features.${key}.body`)}</span>
					</adc-feature-card>
				))}
			</section>

			<section className="mt-12 flex flex-col items-center gap-4" aria-label={t("landing.howAria")}>
				<h2 className="text-2xl text-center font-heading font-bold text-text">{t("landing.howTitle")}</h2>
				<adc-button variant="primary" label={t("landing.signIn")} onClick={() => goToLogin()} />
				<p className="text-xs text-muted text-center">{t("landing.accountNote")}</p>
			</section>
		</div>
	);
}
