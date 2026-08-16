import { AppWithSeo } from "@apps/AppWithSeo.js";

/**
 * ADC Mail App - Cliente de correo de la plataforma.
 */
export default class AdcMailApp extends AppWithSeo {
	async run(): Promise<void> {
		this.registerSeo({
			// Sólo la raíz: es la landing pública. El resto es el buzón de cada persona.
			sitemap: { paths: [{ path: "/", changefreq: "monthly", priority: 0.6 }] },
			pageMeta: {
				defaults: {
					// `noindex` por defecto y sólo `/` lo revierte: cualquier ruta nueva de la app
					// nace fuera del índice sin que haya que acordarse de excluirla.
					robots: "noindex,nofollow",
					titleTemplate: "%s · Abby's Digital Cafe",
					og: { siteName: "Abby's Digital Cafe", locale: "es_ES", type: "website" },
					twitter: { card: "summary" },
					ogBrand: { background: "#efeaff", color: "#332063", brandName: "ADC Correo" },
				},
				pages: [
					{
						path: "/",
						meta: {
							title: "Correo",
							description: "El buzón de tu organización dentro de Abby's Digital Cafe: escribí, adjuntá y organizá sin salir de la plataforma.",
							robots: "index,follow",
						},
					},
				],
			},
		});
		this.logger.logOk("ADC Mail App iniciada");
	}
}
