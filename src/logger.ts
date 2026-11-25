import { normalizePath, TFile } from "obsidian";
import type PomodoroPlugin from "../main";
import type { PomRow } from "./history";
import { dateKey, ensureFolder, faNum, jalaliYear, pad } from "./utils";

export interface DayStats {
	p: number; // تعداد پومودورو
	g: number; // صفحات خوانده‌شده
}

/** جایگزینی توکن‌های تاریخ در الگوی مسیر/نام فایل */
function fillTokens(pattern: string, now: Date, useJalali: boolean): string {
	const y = String(now.getFullYear());
	return pattern
		.replace(/\{\{date\}\}/g, dateKey(now))
		.replace(/\{\{jyear\}\}/g, useJalali ? jalaliYear(now) : y)
		.replace(/\{\{year\}\}/g, y)
		.replace(/\{\{month\}\}/g, pad(now.getMonth() + 1))
		.replace(/\{\{day\}\}/g, pad(now.getDate()));
}

export class PomodoroLogger {
	constructor(private plugin: PomodoroPlugin) {}

	/** مسیر یادداشت روزانه‌ی تاریخ داده‌شده بر اساس تنظیمات */
	dailyPath(now: Date): { dir: string; path: string } {
		const s = this.plugin.settings;
		const dir = normalizePath(fillTokens(s.dailyFolder, now, s.useJalali));
		const name = fillTokens(s.dailyFileName, now, s.useJalali);
		return { dir, path: normalizePath(`${dir}/${name}.md`) };
	}

	/** درج خط پومودورو: اولین جای خالی، وگرنه بعد از آخرین پومودورو، وگرنه زیر عنوان گزارش */
	addPomLine(text: string, book: string, from: number, to: number): string {
		const { fmt, settings } = this.plugin;
		const nl = text.includes("\r\n") ? "\r\n" : "\n";
		const lines = text.split(nl);

		const emptyIdx = lines.findIndex((l) => fmt.matchEmpty(l) !== null);
		if (emptyIdx >= 0) {
			const m = fmt.matchEmpty(lines[emptyIdx])!;
			lines[emptyIdx] = fmt.render(m.indent, m.index, book, from, to);
			return lines.join(nl);
		}

		let lastPom = -1;
		let count = 0;
		lines.forEach((l, i) => {
			if (fmt.isAny(l)) {
				lastPom = i;
				count++;
			}
		});
		const line = fmt.render("", faNum(count + 1), book, from, to);

		if (lastPom >= 0) {
			lines.splice(lastPom + 1, 0, line);
			return lines.join(nl);
		}
		const h = lines.findIndex((l) => l.trim() === settings.reportHeading.trim());
		if (h >= 0) {
			if ((lines[h + 1] ?? "").trim() === "") lines.splice(h + 2, 0, line);
			else lines.splice(h + 1, 0, "", line);
		} else {
			lines.push("", settings.reportHeading, "", line);
		}
		return lines.join(nl);
	}

	/** آمار روزانه از روی خطوط انجام‌شده */
	dayStats(text: string): DayStats {
		let p = 0;
		let g = 0;
		for (const l of text.split(/\r?\n/)) {
			const r = this.plugin.fmt.parse(l);
			if (!r) continue;
			p++;
			if (r.from != null && r.to != null && r.to > r.from) g += r.to - r.from;
		}
		return { p, g };
	}

	/** ثبت پومودورو در یادداشت روزانه‌ی امروز و به‌روزرسانی فراداده */
	async save(book: string, from: number, to: number): Promise<DayStats> {
		const { app, settings: s } = this.plugin;
		const { dir, path } = this.dailyPath(new Date());

		let file = app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			await ensureFolder(app, dir);
			const tpl = app.vault.getAbstractFileByPath(normalizePath(s.templatePath));
			const body =
				tpl instanceof TFile
					? await app.vault.read(tpl)
					: `---\ntype: daily\ntags:\n  - روزانه\n---\n\n${s.reportHeading}\n\n`;
			file = await app.vault.create(path, body);
		}
		const target = file as TFile;

		let newText = "";
		await app.vault.process(target, (t) => (newText = this.addPomLine(t, book, from, to)));
		const st = this.dayStats(newText);

		await app.fileManager.processFrontMatter(target, (fm) => {
			fm[s.pomCountField] = st.p;
			fm[s.pagesField] = st.g;
			fm[s.minutesField] = Math.max(Number(fm[s.minutesField]) || 0, st.p * s.pomMinutes);
		});
		this.plugin.history.invalidate(target.path);
		return st;
	}

	/**
	 * حذف یک پومودوروی ثبت‌شده. قبل از حذف بررسی می‌شود خط هنوز همان است
	 * (اگر کاربر یادداشت را ویرایش کرده باشد، خطای CHANGED می‌دهد).
	 */
	async remove(row: PomRow): Promise<DayStats> {
		const { app, settings: s, fmt } = this.plugin;
		const file = app.vault.getAbstractFileByPath(row.path);
		if (!(file instanceof TFile)) throw new Error("FILE_MISSING");

		let newText = "";
		let removed = false as boolean;
		await app.vault.process(file, (text) => {
			const nl = text.includes("\r\n") ? "\r\n" : "\n";
			const lines = text.split(/\r?\n/);
			const ln = lines[row.i];
			const p = ln !== undefined ? fmt.parse(ln) : null;
			if (!p || p.book !== row.name || p.from !== row.from || p.to !== row.to) return text;
			lines.splice(row.i, 1);
			removed = true;
			newText = lines.join(nl);
			return newText;
		});
		if (!removed) throw new Error("CHANGED");

		const st = this.dayStats(newText);
		await app.fileManager.processFrontMatter(file, (fm) => {
			fm[s.pomCountField] = st.p;
			fm[s.pagesField] = st.g;
			fm[s.minutesField] = Math.max(0, (Number(fm[s.minutesField]) || 0) - s.pomMinutes);
		});
		this.plugin.history.invalidate(file.path);
		return st;
	}
}
