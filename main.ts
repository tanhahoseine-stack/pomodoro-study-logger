import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { CODEBLOCK_ID, registerCodeBlock } from "./src/codeblock";
import { HistoryService } from "./src/history";
import { t } from "./src/i18n";
import { LineFormat, validateTemplate } from "./src/linefmt";
import { PomodoroLogger } from "./src/logger";
import { DATA_VERSION, DEFAULT_SETTINGS, PluginSettings, PomodoroSettingTab } from "./src/settings";
import { computeStats, Snapshot, Tab } from "./src/stats";
import { AddBookModal, PomodoroModal } from "./src/ui/modals";
import { PomodoroView, VIEW_TYPE } from "./src/ui/view";

/** وضعیت فرم در حافظه‌ی نشست (برای حفظ ورودی هنگام رندر مجدد) */
export interface FormState {
	t: number;
	tab?: Tab;
	book?: string;
	from?: string;
	to?: string;
	fromEdited?: boolean;
	msg?: { t: number; ok: boolean; text: string };
}

export default class PomodoroPlugin extends Plugin {
	settings: PluginSettings = { ...DEFAULT_SETTINGS };
	fmt: LineFormat = new LineFormat(DEFAULT_SETTINGS.lineFormat);
	history!: HistoryService;
	logger!: PomodoroLogger;
	formState: FormState = { t: 0 };

	async onload(): Promise<void> {
		await this.loadSettings();
		this.history = new HistoryService(this);
		this.logger = new PomodoroLogger(this);

		this.registerView(VIEW_TYPE, (leaf: WorkspaceLeaf) => new PomodoroView(leaf, this));
		registerCodeBlock(this);
		this.addSettingTab(new PomodoroSettingTab(this.app, this));

		this.addRibbonIcon("timer", t("ribbon"), () => void this.openDefault());

		this.addCommand({ id: "open-default", name: t("cmdOpen"), callback: () => void this.openDefault() });
		this.addCommand({ id: "open-modal", name: t("cmdModal"), callback: () => this.openModal() });
		this.addCommand({ id: "open-sidebar", name: t("cmdSidebar"), callback: () => void this.openSidebar() });
		this.addCommand({ id: "insert-codeblock", name: t("cmdCodeblock"), callback: () => this.insertCodeBlock() });
		this.addCommand({
			id: "add-book",
			name: t("cmdAddBook"),
			callback: () => new AddBookModal(this.app, this, () => undefined).open(),
		});
	}

	/** وضعیت فرم؛ پس از ۱۵ دقیقه بی‌استفاده‌بودن بازنشانی می‌شود */
	getFormState(): FormState {
		const now = Date.now();
		if (!this.formState.t || now - this.formState.t > 15 * 60000) this.formState = { t: now };
		this.formState.t = now;
		return this.formState;
	}

	/** تاریخچه و آمار (روز/هفته/ماه/کل و زنجیره) در یک نمای واحد */
	async getSnapshot(): Promise<Snapshot> {
		const rows = await this.history.rows();
		return { rows, stats: computeStats(rows, this.settings, new Date()) };
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) as Partial<PluginSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
		// مهاجرت از نسخه‌های قدیمی تنظیمات
		if ((saved?.dataVersion ?? 0) < DATA_VERSION) {
			if (this.settings.groupField === "هفته") this.settings.groupField = DEFAULT_SETTINGS.groupField;
			delete (this.settings as unknown as Record<string, unknown>)["activeField"];
			this.settings.dataVersion = DATA_VERSION;
		}
		this.settings.cupEveryDays = Math.max(1, this.settings.cupEveryDays);
		this.rebuildFormat();
	}

	async saveSettings(): Promise<void> {
		this.rebuildFormat();
		this.history?.reset();
		await this.saveData(this.settings);
	}

	private rebuildFormat(): void {
		if (!validateTemplate(this.settings.lineFormat)) this.settings.lineFormat = DEFAULT_SETTINGS.lineFormat;
		this.fmt = new LineFormat(this.settings.lineFormat);
	}

	// ---------- حالت‌های نمایش ----------
	async openDefault(): Promise<void> {
		switch (this.settings.openMode) {
			case "sidebar":
				return this.openSidebar();
			case "codeblock":
				return this.insertCodeBlock();
			default:
				return this.openModal();
		}
	}

	openModal(): void {
		new PomodoroModal(this.app, this).open();
	}

	async openSidebar(): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			if (!leaf) return;
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
		}
		await workspace.revealLeaf(leaf);
	}

	insertCodeBlock(): void {
		const editor = this.app.workspace.activeEditor?.editor;
		if (!editor) {
			new Notice(t("noEditor"));
			return;
		}
		editor.replaceSelection("```" + CODEBLOCK_ID + "\n```\n");
	}
}
