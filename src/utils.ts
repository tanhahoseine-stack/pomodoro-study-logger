import { App } from "obsidian";

/** تبدیل ارقام فارسی و عربی به لاتین */
export const toEn = (s: unknown): string =>
	String(s ?? "")
		.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
		.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/** استخراج عدد صحیح از ورودی (با پشتیبانی از ارقام فارسی/عربی)؛ در صورت نبود عدد null */
export const num = (v: unknown): number | null => {
	const n = parseInt(toEn(v).replace(/[^0-9]/g, ""), 10);
	return Number.isNaN(n) ? null : n;
};

/** نمایش عدد با ارقام فارسی */
export const faNum = (n: number | string): string =>
	String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

export const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const pad = (n: number): string => String(n).padStart(2, "0");

/** کلید تاریخ میلادی محلی به‌صورت YYYY-MM-DD */
export const dateKey = (d: Date): string =>
	`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** سال شمسی با ارقام لاتین (بدون وابستگی خارجی) */
export function jalaliYear(d: Date): string {
	const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
		year: "numeric",
	}).formatToParts(d);
	return parts.find((p) => p.type === "year")?.value ?? String(d.getFullYear());
}

/** تبدیل کلید YYYY-MM-DD به تاریخ (ساعت ۱۲ ظهر تا مشکل تغییر ساعت پیش نیاید) */
export function keyToDate(key: string): Date {
	const [y, m, d] = key.split("-").map(Number);
	return new Date(y, m - 1, d, 12);
}

export function addDays(d: Date, n: number): Date {
	const x = new Date(d);
	x.setDate(x.getDate() + n);
	return x;
}

/** شروع هفته‌ی تاریخ داده‌شده؛ weekStart: ۶ = شنبه، ۰ = یکشنبه، ۱ = دوشنبه (مثل Date.getDay) */
export function weekStartOf(d: Date, weekStart: number): Date {
	return addDays(d, -((d.getDay() - weekStart + 7) % 7));
}

/** کلید ماه (شمسی یا میلادی) برای گروه‌بندی گزارش ماهانه */
export function monthKey(d: Date, useJalali: boolean): string {
	if (!useJalali) return `${d.getFullYear()}-${d.getMonth() + 1}`;
	const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
		year: "numeric",
		month: "numeric",
	}).formatToParts(d);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	return `${get("year")}-${get("month")}`;
}

/** نمایش تاریخ برای کاربر (مثلاً «۵ آذر ۱۴۰۵») */
export function fmtDate(d: Date, useJalali: boolean): string {
	return new Intl.DateTimeFormat(useJalali ? "fa-IR-u-ca-persian" : "fa-IR-u-ca-gregory", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(d);
}

/** نام کتاب از مقدار فیلد (پشتیبانی از [[لینک|نام]] و مسیر) */
export const bookKey = (v: unknown): string =>
	String(v ?? "")
		.replace(/^\[\[|\]\]$/g, "")
		.split("|")[0]
		.split("/")
		.pop()!
		.replace(/\.md$/, "")
		.trim();

/** ساخت پوشه‌ها به‌صورت تو در تو در صورت نبود */
export async function ensureFolder(app: App, path: string): Promise<void> {
	let acc = "";
	for (const seg of path.split("/").filter(Boolean)) {
		acc = acc ? `${acc}/${seg}` : seg;
		if (!app.vault.getAbstractFileByPath(acc)) {
			try {
				await app.vault.createFolder(acc);
			} catch (e) {
				// ممکن است هم‌زمان ساخته شده باشد
				if (!app.vault.getAbstractFileByPath(acc)) throw e;
			}
		}
	}
}
