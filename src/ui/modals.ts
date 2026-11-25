import { App, Modal, Notice, Setting, normalizePath } from "obsidian";
import type PomodoroPlugin from "../../main";
import { createBook, listCategories } from "../books";
import { t } from "../i18n";
import { num } from "../utils";
import { PomodoroForm } from "./form";

/** مودال اصلی ثبت پومودورو */
export class PomodoroModal extends Modal {
	constructor(app: App, private plugin: PomodoroPlugin) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(t("sidebarTitle"));
		this.contentEl.addClass("psl-modal");
		const form = new PomodoroForm(this.plugin, this.contentEl.createDiv());
		void form.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** مودال تأیید (برای کارهای غیرقابل‌برگشت مثل حذف) */
export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private title: string,
		private body: string,
		private yes: string,
		private no: string,
		private onYes: () => void | Promise<void>
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(this.title);
		this.contentEl.setAttr("dir", "rtl");
		this.contentEl.createEl("p", { text: this.body, cls: "psl-pre" });
		new Setting(this.contentEl)
			.addButton((b) =>
				b
					.setButtonText(this.yes)
					.setWarning()
					.onClick(() => {
						this.close();
						void this.onYes();
					})
			)
			.addButton((b) => b.setButtonText(this.no).onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** مودال افزودن سریع کتاب */
export class AddBookModal extends Modal {
	constructor(app: App, private plugin: PomodoroPlugin, private onDone: (name: string) => void) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("psl-modal");
		contentEl.setAttr("dir", "rtl");
		this.titleEl.setText(t("addBookTitle"));

		const data = { name: "", start: "1", end: "", group: "", onDesk: true };

		new Setting(contentEl)
			.setName(t("bookName"))
			.setDesc(t("bookNameDesc"))
			.addText((c) => c.onChange((v) => (data.name = v)));
		new Setting(contentEl).setName(t("startPage")).addText((c) => {
			c.setValue(data.start).onChange((v) => (data.start = v));
			c.inputEl.inputMode = "numeric";
		});
		new Setting(contentEl)
			.setName(t("endPage"))
			.setDesc(t("endPageDesc"))
			.addText((c) => {
				c.onChange((v) => (data.end = v));
				c.inputEl.inputMode = "numeric";
			});

		// دسته‌بندی آزاد؛ دسته‌های موجود و چند پیشنهاد (هفته اول …) در datalist
		const dl = contentEl.createEl("datalist", { attr: { id: "psl-categories" } });
		const sugg = new Set(listCategories(this.plugin));
		for (const x of ["هفته اول", "هفته دوم", "هفته سوم"]) sugg.add(x);
		for (const x of sugg) dl.createEl("option", { value: x });
		new Setting(contentEl)
			.setName(t("groupName"))
			.setDesc(t("groupNameDesc"))
			.addText((c) => {
				c.setPlaceholder(t("groupPlaceholder")).onChange((v) => (data.group = v));
				c.inputEl.setAttr("list", "psl-categories");
			});

		new Setting(contentEl)
			.setName(t("onDesk"))
			.setDesc(t("onDeskDesc"))
			.addToggle((c) => c.setValue(true).onChange((v) => (data.onDesk = v)));

		new Setting(contentEl).addButton((b) =>
			b
				.setButtonText(t("create"))
				.setCta()
				.onClick(async () => {
					// حذف نویسه‌های غیرمجاز نام فایل
					const name = data.name.replace(/[\\/:*?"<>|#^[\]]/g, "").trim();
					if (!name) return void new Notice(t("bookNameEmpty"));
					const start = num(data.start) ?? 0;
					const end = num(data.end);
					if (end != null && end <= start) return void new Notice(t("bookInvalidRange"));

					const path = normalizePath(`${this.plugin.settings.booksFolder}/${name}.md`);
					if (this.app.vault.getAbstractFileByPath(path)) return void new Notice(t("bookExists"));

					b.setDisabled(true);
					try {
						await createBook(this.plugin, {
							name,
							start,
							end,
							group: data.group.trim(),
							onDesk: data.onDesk,
						});
						new Notice(t("bookCreated", { name }));
						this.close();
						this.onDone(name);
					} catch (e) {
						console.error("PomodoroLogger:", e);
						b.setDisabled(false);
						const msg =
							e instanceof Error && e.message === "EXISTS"
								? t("bookExists")
								: e instanceof Error
									? e.message
									: String(e);
						new Notice(t("bookError", { msg }));
					}
				})
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
