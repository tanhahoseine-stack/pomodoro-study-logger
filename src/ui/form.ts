import type PomodoroPlugin from "../../main";
import { Book, finishIfDone, listBooks, reopenIfUnfinished } from "../books";
import type { PomRow } from "../history";
import { I18nKey, t } from "../i18n";
import type { Snapshot, Tab } from "../stats";
import { dateKey, faNum, fmtDate, keyToDate, num } from "../utils";
import { AddBookModal, ConfirmModal } from "./modals";
import { renderStats, renderStreak } from "./reports";

const TABS: [Tab, I18nKey][] = [
	["log", "tabLog"],
	["stats", "tabStats"],
	["streak", "tabStreak"],
];

/**
 * فرم اصلی؛ در مودال، سایدبار و Code Block مشترک است.
 * سه تب دارد: ثبت، گزارش‌ها، استمرار. وضعیت فرم در `plugin.formState` نگهداری می‌شود.
 * اگر `only` داده شود فقط همان تب (بدون نوار تب) نمایش داده می‌شود.
 */
export class PomodoroForm {
	private busy = false;

	constructor(private plugin: PomodoroPlugin, private root: HTMLElement, private only: Tab | null = null) {}

	/** آیا فوکوس کاربر داخل فرم است؟ (برای جلوگیری از رندر مجدد حین تایپ) */
	hasFocus(): boolean {
		return this.root.contains(document.activeElement);
	}

	async render(): Promise<void> {
		try {
			await this.draw();
		} catch (e) {
			console.error("PomodoroLogger:", e);
			this.root.empty();
			this.root.createDiv({
				cls: "psl-bad",
				text: t("formError", { msg: e instanceof Error ? e.message : String(e) }),
			});
		}
	}

	private async draw(): Promise<void> {
		const p = this.plugin;
		const s = p.settings;
		const st = p.getFormState();
		const snap = await p.getSnapshot();
		const today = snap.stats.today;
		const pct = Math.min(100, Math.round((today.poms / s.goalPomodoros) * 100));
		const tab: Tab = this.only ?? st.tab ?? "log";

		const root = this.root;
		root.empty();
		root.addClass("psl");
		root.setAttr("dir", "rtl");

		const head = root.createDiv({ cls: "psl-head" });
		head.createEl("b", { text: t("formTitle") });
		head.createSpan({
			cls: "psl-sub",
			text: t("todaySummary", { poms: faNum(today.poms), goal: faNum(s.goalPomodoros), pages: faNum(today.pages) }),
		});

		if (s.showProgress) {
			const bar = root.createDiv({
				cls: "psl-bar",
				attr: {
					role: "progressbar",
					"aria-valuemin": "0",
					"aria-valuemax": "100",
					"aria-valuenow": String(pct),
				},
			});
			const fill = bar.createDiv();
			fill.setCssStyles({ width: "0%" });
			window.requestAnimationFrame(() => fill.setCssStyles({ width: `${pct}%` }));
		}

		if (!this.only) {
			const bar = root.createDiv({ cls: "psl-tabs", attr: { role: "tablist" } });
			for (const [id, label] of TABS) {
				const b = bar.createEl("button", {
					cls: "psl-tab" + (id === tab ? " psl-tab-on" : ""),
					text: t(label),
					attr: { role: "tab", "aria-selected": String(id === tab) },
				});
				b.addEventListener("click", () => {
					st.tab = id;
					void this.render();
				});
			}
		}

		const panel = root.createDiv({ cls: "psl-panel", attr: { role: "tabpanel" } });
		if (tab === "stats") renderStats(panel, p, snap);
		else if (tab === "streak") renderStreak(panel, p, snap);
		else this.renderLog(panel, snap);
	}

	// ======================= تب ثبت =======================
	private renderLog(panel: HTMLElement, snap: Snapshot): void {
		const p = this.plugin;
		const s = p.settings;
		const st = p.getFormState();
		const books = listBooks(p);
		const last = new Map<string, number>();
		for (const r of snap.rows) if (r.name && r.to != null) last.set(r.name, r.to);
		const startOf = (b: Book) => Math.max(b.start, last.get(b.name) ?? b.start);

		const grid = panel.createDiv({ cls: "psl-grid" });

		const lbBook = grid.createEl("label", { cls: "psl-field psl-field-book" });
		lbBook.createSpan({ text: t("book") });
		const selB = lbBook.createEl("select", { cls: "psl-book" });
		selB.createEl("option", { text: t("chooseBook"), value: "" });

		// گروه‌بندی بر اساس دسته‌بندی
		const groups = new Map<string, Book[]>();
		for (const b of books) {
			const g = b.group || "—";
			if (!groups.has(g)) groups.set(g, []);
			groups.get(g)!.push(b);
		}
		const sorted = [...groups.entries()].sort((a, b) => {
			const na = num(a[0]);
			const nb = num(b[0]);
			if (na != null && nb != null && na !== nb) return nb - na;
			return a[0].localeCompare(b[0], "fa");
		});
		for (const [g, arr] of sorted) {
			const og = selB.createEl("optgroup", { attr: { label: g } });
			for (const b of arr) og.createEl("option", { text: b.name, value: b.name });
		}

		const lbFrom = grid.createEl("label", { cls: "psl-field" });
		lbFrom.createSpan({ text: t("fromLabel") });
		const inF = lbFrom.createEl("input", {
			type: "text",
			cls: "psl-from",
			attr: { inputmode: "numeric", autocomplete: "off" },
		});

		const lbTo = grid.createEl("label", { cls: "psl-field" });
		lbTo.createSpan({ text: t("toLabel") });
		const inT = lbTo.createEl("input", {
			type: "text",
			cls: "psl-to",
			attr: { inputmode: "numeric", autocomplete: "off", placeholder: t("toPlaceholder") },
		});

		const info = panel.createDiv({ cls: "psl-info", attr: { "aria-live": "polite" } });

		const act = panel.createDiv({ cls: "psl-act" });
		const btn = act.createEl("button", { cls: "psl-go mod-cta", text: t("save") });
		const btnAdd = act.createEl("button", { cls: "psl-add", text: t("addBook") });
		const recentMsg = st.msg && Date.now() - st.msg.t < 15000 ? st.msg : null;
		const msg = act.createSpan({
			cls: "psl-msg" + (recentMsg ? (recentMsg.ok ? " psl-ok" : " psl-bad") : ""),
			text: recentMsg ? recentMsg.text : "",
			attr: { role: "status", "aria-live": "polite" },
		});

		if (books.length === 0) panel.createDiv({ cls: "psl-bad", text: t("noBooks") });

		this.renderRecent(panel, snap);

		// ---------- منطق ----------
		const cur = () => books.find((b) => b.name === selB.value);
		const flash = (text: string, ok: boolean) => {
			msg.className = "psl-msg " + (ok ? "psl-ok" : "psl-bad");
			msg.setText(text);
		};
		const chip = (text: string, cls = "") => info.createSpan({ cls: ("psl-chip " + cls).trim(), text });

		const update = () => {
			const b = cur();
			const f = num(inF.value);
			const to = num(inT.value);
			st.book = selB.value;
			st.from = inF.value;
			st.to = inT.value;
			st.t = Date.now();
			info.empty();
			if (!b) {
				info.createSpan({ cls: "psl-sub", text: t("pickBookHint") });
				return;
			}
			chip(t("range", { s: faNum(b.start), e: b.end != null ? faNum(b.end) : "؟" }));
			if (f != null && to != null) {
				if (to > f) chip(t("pagesChip", { n: faNum(to - f) }), "psl-acc");
				else chip(t("endGtStart"), "psl-bad");
			}
			if (b.end != null) {
				const at = to ?? f ?? b.start;
				if (at > b.end) chip(t("overRange", { e: faNum(b.end) }), "psl-bad");
				else chip(t("remaining", { n: faNum(b.end - at) }));
			}
		};

		selB.addEventListener("change", () => {
			const b = cur();
			st.fromEdited = false;
			inF.value = b ? String(startOf(b)) : "";
			inT.value = "";
			update();
			if (b) inT.focus();
		});
		inF.addEventListener("input", () => {
			st.fromEdited = true;
			update();
		});
		inT.addEventListener("input", update);
		inT.addEventListener("keydown", (e) => {
			if (e.key === "Enter") btn.click();
		});

		btnAdd.addEventListener("click", () => {
			new AddBookModal(p.app, p, (name) => {
				st.book = name;
				st.fromEdited = false;
				st.from = undefined;
				st.to = "";
				void this.render();
			}).open();
		});

		btn.addEventListener("click", () => {
			void (async () => {
				if (this.busy) return;
				const b = cur();
				const f = num(inF.value);
				const to = num(inT.value);
				if (!b) return flash(t("needBook"), false);
				if (f == null || to == null) return flash(t("needPages"), false);
				if (to <= f) return flash(t("endGtStart"), false);

				this.busy = true;
				btn.disabled = true;
				btn.setText(t("saving"));
				try {
					const before = snap.stats.streak;
					const res = await p.logger.save(b.name, f, to);
					const finished = await finishIfDone(p, b, to);
					const after = (await p.getSnapshot()).stats.streak;

					let text =
						t("saved", {
							book: b.name,
							from: faNum(f),
							to: faNum(to),
							n: faNum(to - f),
							p: faNum(res.p),
							goal: faNum(s.goalPomodoros),
						}) + (res.p >= s.goalPomodoros ? t("goalDone") : "");
					if (finished) text += t("bookFinished", { book: b.name });
					if (after.current > before.current) {
						const cup = Math.max(1, s.cupEveryDays);
						if (after.current % cup === 0) text += t("cupEarned", { n: faNum(after.current) });
						if (after.current > before.record && after.current > 1)
							text += t("recordNew", { n: faNum(after.current) });
					}

					st.from = String(to);
					st.fromEdited = true;
					st.to = "";
					if (finished) st.book = "";
					st.msg = { t: Date.now(), ok: true, text };
				} catch (e) {
					console.error("PomodoroLogger:", e);
					st.msg = {
						t: Date.now(),
						ok: false,
						text: t("saveError", { msg: e instanceof Error ? e.message : String(e) }),
					};
				} finally {
					this.busy = false;
				}
				await this.render();
			})();
		});

		// ---------- بازگرداندن وضعیت ----------
		if (st.book && books.some((b) => b.name === st.book)) {
			selB.value = st.book;
			const b = cur()!;
			inF.value = st.fromEdited && st.from != null ? st.from : String(startOf(b));
			inT.value = st.to ?? "";
		}
		update();
	}

	// ======================= آخرین ثبت‌ها و حذف =======================
	private renderRecent(panel: HTMLElement, snap: Snapshot): void {
		const s = this.plugin.settings;
		const tk = dateKey(new Date());
		const sec = panel.createDiv({ cls: "psl-recent" });
		sec.createEl("b", { text: t("recentTitle") });

		const recent = snap.rows.slice(-5).reverse();
		if (recent.length === 0) {
			sec.createDiv({ cls: "psl-sub", text: t("recentEmpty") });
			return;
		}
		sec.createDiv({ cls: "psl-sub", text: t("recentHint") });

		const ul = sec.createEl("ul", { cls: "psl-recent-list" });
		for (const r of recent) {
			const desc = this.describe(r);
			const date = r.key === tk ? t("today") : fmtDate(keyToDate(r.key), s.useJalali);
			const li = ul.createEl("li");
			li.createSpan({ cls: "psl-recent-text", text: desc });
			li.createSpan({ cls: "psl-sub", text: date });
			const del = li.createEl("button", {
				cls: "psl-del",
				text: t("del"),
				attr: { "aria-label": t("delAria", { desc }) },
			});
			del.addEventListener("click", () => {
				new ConfirmModal(
					this.plugin.app,
					t("confirmTitle"),
					t("confirmBody", { desc, date }),
					t("confirmYes"),
					t("confirmNo"),
					() => this.removeRow(r, desc)
				).open();
			});
		}
	}

	private describe(r: PomRow): string {
		return t("recentItem", {
			book: r.name || "؟",
			from: r.from != null ? faNum(r.from) : "؟",
			to: r.to != null ? faNum(r.to) : "؟",
		});
	}

	/** حذف ثبت، به‌روزرسانی فراداده و در صورت لزوم برگرداندن کتاب به میز مطالعه */
	private async removeRow(r: PomRow, desc: string): Promise<void> {
		const p = this.plugin;
		const st = p.getFormState();
		try {
			await p.logger.remove(r);
			const rows = (await p.getSnapshot()).rows;
			let lastAfter: number | null = null;
			for (const x of rows) if (x.name === r.name && x.to != null) lastAfter = x.to;
			const reopened = await reopenIfUnfinished(p, r.name, r.to, lastAfter);

			if (st.book === r.name) {
				st.fromEdited = false;
				st.from = undefined;
				st.to = "";
			}
			st.msg = { t: Date.now(), ok: true, text: t("removed", { desc }) + (reopened ? t("removedReopen") : "") };
		} catch (e) {
			console.error("PomodoroLogger:", e);
			const code = e instanceof Error ? e.message : String(e);
			const reason = code === "CHANGED" ? t("removeChanged") : code === "FILE_MISSING" ? t("fileMissing") : code;
			st.msg = { t: Date.now(), ok: false, text: t("removeError", { msg: reason }) };
		}
		await this.render();
	}
}
