import { debounce, ItemView, WorkspaceLeaf } from "obsidian";
import type PomodoroPlugin from "../../main";
import { t } from "../i18n";
import { PomodoroForm } from "./form";

export const VIEW_TYPE = "pomodoro-study-logger-view";

/** نمای سایدبار ثبت پومودورو */
export class PomodoroView extends ItemView {
	private form: PomodoroForm | null = null;

	constructor(leaf: WorkspaceLeaf, private plugin: PomodoroPlugin) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("sidebarTitle");
	}

	getIcon(): string {
		return "timer";
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("psl-view");
		this.form = new PomodoroForm(this.plugin, this.contentEl.createDiv());
		await this.form.render();

		// تازه‌سازی خودکار هنگام تغییر ژورنال/کتاب‌ها، بدون مزاحمت برای تایپ کاربر
		const refresh = debounce(
			() => {
				if (this.form && !this.form.hasFocus()) void this.form.render();
			},
			800,
			true
		);
		this.registerEvent(this.app.metadataCache.on("changed", refresh));
		this.registerEvent(this.app.vault.on("delete", refresh));
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
		this.form = null;
	}
}
