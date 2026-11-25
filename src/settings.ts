import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type PomodoroPlugin from "../main";
import { migrateLegacy } from "./books";
import { t } from "./i18n";
import { validateTemplate } from "./linefmt";

export type OpenMode = "modal" | "sidebar" | "codeblock";

/** نسخه‌ی ساختار تنظیمات (برای مهاجرت از نسخه‌های قدیمی) */
export const DATA_VERSION = 2;

export interface PluginSettings {
	dataVersion: number;
	// مسیرها
	journalRoot: string;
	dailyFolder: string;
	dailyFileName: string;
	booksFolder: string;
	templatePath: string;
	// پومودورو
	pomMinutes: number;
	goalPomodoros: number;
	// فراداده‌ی کتاب
	bookTypeField: string;
	bookTypeValue: string;
	deskField: string; // میز مطالعه
	startField: string;
	endField: string;
	groupField: string; // دسته‌بندی
	autoRemoveFinished: boolean;
	// فراداده‌ی روزانه
	pomCountField: string;
	pagesField: string;
	minutesField: string;
	// خط پومودورو
	lineFormat: string;
	reportHeading: string;
	// گزارش و استمرار
	weekStart: number;
	streakMinPoms: number;
	cupEveryDays: number;
	heatmapWeeks: number;
	// تقویم و نمایش
	useJalali: boolean;
	showProgress: boolean;
	openMode: OpenMode;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	dataVersion: DATA_VERSION,
	journalRoot: "Journal",
	dailyFolder: "Journal/{{jyear}}/Daily",
	dailyFileName: "{{date}}",
	booksFolder: "03 مطالعه/کتاب‌ها",
	templatePath: "00 الگو/الگوی روزانه.md",
	pomMinutes: 25,
	goalPomodoros: 6,
	bookTypeField: "type",
	bookTypeValue: "کتاب",
	deskField: "میز_مطالعه",
	startField: "ص_ابتدا",
	endField: "ص_انتها",
	groupField: "دسته_بندی",
	autoRemoveFinished: true,
	pomCountField: "پومودورو",
	pagesField: "صفحات_خوانده",
	minutesField: "مطالعه_دقیقه",
	lineFormat: "- [x] 🍅{{index}} [کتاب:: {{book}}] [از:: {{from}}] [تا:: {{to}}]",
	reportHeading: "## گزارش مطالعه",
	weekStart: 6,
	streakMinPoms: 1,
	cupEveryDays: 5,
	heatmapWeeks: 20,
	useJalali: true,
	showProgress: true,
	openMode: "modal",
};

type StringKey = Exclude<
	{
		[K in keyof PluginSettings]: PluginSettings[K] extends string ? K : never;
	}[keyof PluginSettings],
	"openMode"
>;
type NumberKey = Exclude<
	{
		[K in keyof PluginSettings]: PluginSettings[K] extends number ? K : never;
	}[keyof PluginSettings],
	"dataVersion" | "weekStart"
>;
type BoolKey = {
	[K in keyof PluginSettings]: PluginSettings[K] extends boolean ? K : never;
}[keyof PluginSettings];

export class PomodoroSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: PomodoroPlugin) {
		super(app, plugin);
	}

	private set(key: keyof PluginSettings, value: unknown): void {
		(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.setAttr("dir", "rtl");

		new Setting(containerEl).setName("مسیرها").setHeading();
		this.text("journalRoot", "پوشه‌ی ریشه‌ی ژورنال", "برای خواندن تاریخچه‌ی پومودوروها از همه‌ی یادداشت‌های این پوشه استفاده می‌شود.");
		this.text(
			"dailyFolder",
			"پوشه‌ی یادداشت روزانه",
			"می‌تواند شامل {{jyear}} (سال شمسی)، {{year}}، {{month}}، {{day}} و {{date}} باشد."
		);
		this.text("dailyFileName", "الگوی نام فایل روزانه", "پیش‌فرض {{date}} یعنی YYYY-MM-DD (میلادی). پسوند md خودکار اضافه می‌شود.");
		this.text("booksFolder", "پوشه‌ی کتاب‌ها", "یادداشت‌های کتاب از این پوشه خوانده می‌شوند.");
		this.text("templatePath", "مسیر فایل الگوی روزانه", "اگر فایل موجود نباشد، یک ساختار پیش‌فرض ساخته می‌شود.");

		new Setting(containerEl).setName("پومودورو").setHeading();
		this.number("pomMinutes", "مدت هر پومودورو (دقیقه)", "برای محاسبه‌ی دقایق مطالعه در یادداشت روزانه و گزارش‌ها.");
		this.number("goalPomodoros", "هدف روزانه (تعداد پومودورو)", "برای نوار پیشرفت، پیام تکمیل هدف و شدت رنگ نقشه‌ی گرمایی.");

		new Setting(containerEl).setName("فراداده‌ی کتاب").setHeading();
		this.text("bookTypeField", "نام فیلد نوع", "مثلاً type");
		this.text("bookTypeValue", "مقدار فیلد «نوع کتاب»", "یادداشت‌هایی که فیلد نوع‌شان برابر این مقدار است، کتاب شناخته می‌شوند.");
		this.text("deskField", "نام فیلد «میز مطالعه»", "فقط کتاب‌هایی که این فیلدشان true باشد در فهرست ثبت پومودورو نمایش داده می‌شوند.");
		this.text("startField", "نام فیلد صفحه‌ی ابتدا");
		this.text("endField", "نام فیلد صفحه‌ی انتها");
		this.text("groupField", "نام فیلد دسته‌بندی", "برای گروه‌بندی کتاب‌ها در فهرست؛ هر مقداری که بخواهی (مثلاً هفته اول).");
		this.toggle("autoRemoveFinished", "برداشتن خودکار کتاب تمام‌شده از میز مطالعه", "وقتی صفحه‌ی پایان ثبت‌شده به انتهای محدوده‌ی کتاب برسد، میز مطالعه‌ی آن کتاب خاموش می‌شود. اگر آن ثبت را حذف کنی، کتاب دوباره به میز برمی‌گردد.");
		new Setting(containerEl)
			.setName("انتقال کتاب‌های قدیمی")
			.setDesc("فیلد قدیمی «فعال» را به میز مطالعه و «هفته» را به دسته‌بندی منتقل می‌کند (فقط یادداشت‌های داخل پوشه‌ی کتاب‌ها).")
			.addButton((b) =>
				b.setButtonText("انتقال").onClick(async () => {
					try {
						const n = await migrateLegacy(this.plugin);
						new Notice(`${n} یادداشت کتاب به‌روز شد.`);
					} catch (e) {
						console.error("PomodoroLogger:", e);
						new Notice(t("bookError", { msg: e instanceof Error ? e.message : String(e) }));
					}
				})
			);

		new Setting(containerEl).setName("فراداده‌ی روزانه").setHeading();
		this.text("pomCountField", "نام فیلد تعداد پومودورو");
		this.text("pagesField", "نام فیلد صفحات خوانده‌شده");
		this.text("minutesField", "نام فیلد دقایق مطالعه");

		new Setting(containerEl).setName("فرمت خط پومودورو").setHeading();
		new Setting(containerEl)
			.setName("قالب خط پومودورو")
			.setDesc("جایگزین‌ها: {{index}}، {{book}}، {{from}}، {{to}}. حتماً باید {{book}}، {{from}} و {{to}} در قالب باشند.")
			.addTextArea((c) => {
				c.setValue(this.plugin.settings.lineFormat).onChange(async (v) => {
					if (!validateTemplate(v)) {
						new Notice(t("invalidTemplate"));
						return;
					}
					this.plugin.settings.lineFormat = v.trim();
					await this.plugin.saveSettings();
				});
				c.inputEl.rows = 3;
				c.inputEl.addClass("psl-setting-wide");
			});
		this.text("reportHeading", "عنوان بخش گزارش مطالعه", "اگر یادداشت روزانه جای خالی پومودورو نداشته باشد، خط جدید زیر این عنوان درج می‌شود.");

		new Setting(containerEl).setName("گزارش و استمرار").setHeading();
		new Setting(containerEl)
			.setName("شروع هفته")
			.setDesc("برای گزارش «این هفته» و ردیف‌های نقشه‌ی گرمایی.")
			.addDropdown((c) =>
				c
					.addOption("6", "شنبه")
					.addOption("0", "یکشنبه")
					.addOption("1", "دوشنبه")
					.setValue(String(this.plugin.settings.weekStart))
					.onChange(async (v) => {
						this.set("weekStart", parseInt(v, 10));
						await this.plugin.saveSettings();
					})
			);
		this.number("streakMinPoms", "حداقل پومودورو برای شمرده شدن یک روز", "روزی در زنجیره‌ی استمرار حساب می‌شود که حداقل این تعداد پومودورو داشته باشد.");
		this.number("cupEveryDays", "هر چند روز استمرار یک کاپ؟", "پیش‌فرض ۵ روز پیاپی.");
		this.number("heatmapWeeks", "تعداد هفته‌ی نقشه‌ی گرمایی", "بین ۴ تا ۵۳.");

		new Setting(containerEl).setName("تقویم").setHeading();
		this.toggle("useJalali", "استفاده از تقویم شمسی", "اگر روشن باشد، {{jyear}} سال شمسی و گزارش ماهانه بر اساس ماه شمسی است؛ اگر خاموش باشد میلادی.");

		new Setting(containerEl).setName("نمایش").setHeading();
		this.toggle("showProgress", "نمایش نوار پیشرفت روزانه");
		new Setting(containerEl)
			.setName("حالت باز شدن پیش‌فرض")
			.setDesc("رفتار آیکون نوار کناری و دستور اصلی.")
			.addDropdown((c) =>
				c
					.addOption("modal", "مودال")
					.addOption("sidebar", "سایدبار")
					.addOption("codeblock", "درج Code Block در یادداشت")
					.setValue(this.plugin.settings.openMode)
					.onChange(async (v) => {
						this.set("openMode", v as OpenMode);
						await this.plugin.saveSettings();
					})
			);
	}

	private text(key: StringKey, name: string, desc = ""): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((c) =>
				c
					.setPlaceholder(DEFAULT_SETTINGS[key])
					.setValue(this.plugin.settings[key])
					.onChange(async (v) => {
						this.set(key, v.trim());
						await this.plugin.saveSettings();
					})
			);
	}

	private number(key: NumberKey, name: string, desc = ""): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((c) => {
				c.setValue(String(this.plugin.settings[key])).onChange(async (v) => {
					let n = parseInt(v.replace(/[^0-9]/g, ""), 10);
					if (Number.isNaN(n) || n <= 0) return;
					if (key === "heatmapWeeks") n = Math.min(53, Math.max(4, n));
					this.set(key, n);
					await this.plugin.saveSettings();
				});
				c.inputEl.inputMode = "numeric";
			});
	}

	private toggle(key: BoolKey, name: string, desc = ""): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addToggle((c) =>
				c.setValue(this.plugin.settings[key]).onChange(async (v) => {
					this.set(key, v);
					await this.plugin.saveSettings();
				})
			);
	}
}
