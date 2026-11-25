import { normalizePath, TFile } from "obsidian";
import type PomodoroPlugin from "../main";
import { toEn } from "./utils";

export interface PomRow {
	key: string; // YYYY-MM-DD
	path: string; // مسیر یادداشت روزانه
	i: number; // شماره‌ی خط
	name: string;
	from: number | null;
	to: number | null;
}

interface CacheEntry {
	mtime: number;
	size: number;
	rows: PomRow[];
}

/**
 * تاریخچه‌ی پومودوروها از یادداشت‌های ژورنال.
 * نتیجه‌ی هر فایل بر اساس mtime/size کش می‌شود تا در هر رندر فقط فایل‌های تغییرکرده خوانده شوند.
 */
export class HistoryService {
	private cache = new Map<string, CacheEntry>();

	constructor(private plugin: PomodoroPlugin) {}

	/** باطل کردن کش یک فایل (پس از نوشتن در آن) */
	invalidate(path: string): void {
		this.cache.delete(path);
	}

	/** پاک‌سازی کامل کش (مثلاً پس از تغییر تنظیمات) */
	reset(): void {
		this.cache.clear();
	}

	async rows(): Promise<PomRow[]> {
		const { app, settings, fmt } = this.plugin;
		const prefix = normalizePath(settings.journalRoot).replace(/\/+$/, "") + "/";
		const files = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(prefix));
		const alive = new Set(files.map((f) => f.path));
		for (const p of this.cache.keys()) if (!alive.has(p)) this.cache.delete(p);

		const out: PomRow[] = [];
		for (const f of files) {
			const rows = await this.fileRows(f, fmt);
			out.push(...rows);
		}
		out.sort((a, b) => (a.key === b.key ? a.i - b.i : a.key < b.key ? -1 : 1));
		return out;
	}

	private async fileRows(f: TFile, fmt: PomodoroPlugin["fmt"]): Promise<PomRow[]> {
		const hit = this.cache.get(f.path);
		if (hit && hit.mtime === f.stat.mtime && hit.size === f.stat.size) return hit.rows;

		const rows: PomRow[] = [];
		const m = toEn(f.basename).match(/(\d{4})-(\d{2})-(\d{2})/);
		if (m) {
			try {
				const text = await this.plugin.app.vault.cachedRead(f);
				text.split(/\r?\n/).forEach((ln, i) => {
					const p = fmt.parse(ln);
					if (p) rows.push({ key: m[0], path: f.path, i, name: p.book, from: p.from, to: p.to });
				});
			} catch (e) {
				console.error("PomodoroLogger: خواندن تاریخچه ناموفق بود:", f.path, e);
			}
		}
		this.cache.set(f.path, { mtime: f.stat.mtime, size: f.stat.size, rows });
		return rows;
	}
}
