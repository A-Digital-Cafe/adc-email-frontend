import type { AccountInfo } from "../utils/mail-api.ts";
import type { TFn } from "../types.ts";

interface Props {
	account: AccountInfo;
	t: TFn;
}

function formatBytes(bytes: number): string {
	if (bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
	return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

export function QuotaBanner({ account, t }: Readonly<Props>) {
	const isOrg = (account.account.scope ?? account.scope) === "org";
	// El buzón de org descuenta del almacenamiento agregado de la organización;
	// el personal, de la cuota del usuario.
	const used = isOrg ? account.orgStorageUsedBytes || 0 : account.account.storageUsedBytes || 0;
	const total = (isOrg ? account.orgLimits.orgStorageBytes : account.userLimits.storageBytes) || 1;
	const ratio = Math.min(1, used / total);
	const nearFull = ratio >= 0.85;

	return (
		<div className="flex items-center justify-between gap-4 border-b border-text/10 px-4 py-2 text-sm">
			<div className="flex items-center gap-2">
				<adc-icon-app-mail size="1.25rem" />
				<span className="font-medium">{account.account.address}</span>
			</div>
			<div className="flex items-center gap-2">
				<span className={nearFull ? "text-danger" : "opacity-70"}>
					{t("quota.storage")}: {formatBytes(used)} / {formatBytes(total)}
				</span>
				<div className="h-2 w-32 overflow-hidden rounded-full bg-alt">
					<div className={`h-full ${nearFull ? "bg-danger" : "bg-primary"}`} style={{ width: `${ratio * 100}%` }} />
				</div>
			</div>
		</div>
	);
}
