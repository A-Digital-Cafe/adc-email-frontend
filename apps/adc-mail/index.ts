import { BaseApp } from "@apps/BaseApp.js";

/**
 * ADC Mail App - Cliente de correo de la plataforma.
 */
export default class AdcMailApp extends BaseApp {
	async run(): Promise<void> {
		this.logger.logOk("ADC Mail App iniciada");
	}
}
