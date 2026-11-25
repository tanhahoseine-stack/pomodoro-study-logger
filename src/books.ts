import { normalizePath, TFile } from "obsidian";
import type PomodoroPlugin from "../main";
import { ensureFolder, num } from "./utils";

export interface Book {
	name: string;
	path: string;
	start: number;
	end: number | null;
	group: string; // دسته‌بندی
}

export interface NewBookData {
	name: string;
	start: number;
	end: number | null;
	group: string;
	onDesk: boolean;
}

const isTrue = (v: unknown): boolean => v === true || String(v).toLowerCase() === "true";

/** همه‌ی یادداشت‌های کتاب (چه روی میز مطالعه چه نه) */
function bookFiles(plugin: PomodoroPlugin): TFile[] {
	const { app, settings: s } = plugin;
	const prefix = normalizePath(s.booksFolder).replace(/\/+$/, "") + "/";
	return app.vault.getMarkdownFiles().filter((f) => {
		if (!f.path.startsWith(prefix)) return false;
		const fm = app.metadataCache.getFileCache(f)?.frontmatter;
		return !!fm && String(fm[s.bookTypeField]) === s.bookTypeValue;
	});
}

/** کتاب‌های روی «میز مطالعه» از MetadataCache (بدون خواندن فایل‌ها) */
export function listBooks(plugin: PomodoroPlugin): Book[] {
	const { app, settings: s } = plugin;
	const res: Book[] = [];
	for (const f of bookFiles(plugin)) {
		const fm = app.metadataCache.getFileCache(f)?.frontmatter;
		if (!fm || !isTrue(fm[s.deskField])) continue;
		res.push({
			name: f.basename,
			path: f.path,
			start: num(fm[s.startField]) ?? 0,
			end: num(fm[s.endField]),
			group: fm[s.groupField] ? String(fm[s.groupField]).trim() : "",
		});
	}
	return res;
}

/** دسته‌بندی‌های موجود در همه‌ی کتاب‌ها (برای پیشنهاد در فرم افزودن کتاب) */
export function listCategories(plugin: PomodoroPlugin): string[] {
	const { app, settings: s } = plugin;
	const set = new Set<string>();
	for (const f of bookFiles(plugin)) {
		const g = app.metadataCache.getFileCache(f)?.frontmatter?.[s.groupField];
		if (g) set.add(String(g).trim());
	}
	return [...set].sort((a, b) => a.localeCompare(b, "fa"));
}

export function findBookFile(plugin: PomodoroPlugin, name: string): TFile | null {
	return bookFiles(plugin).find((f) => f.basename === name) ?? null;
}

/** روشن/خاموش کردن «میز مطالعه» در فراداده‌ی یادداشت کتاب */
export async function setOnDesk(plugin: PomodoroPlugin, file: TFile, value: boolean): Promise<void> {
	const field = plugin.settings.deskField;
	await plugin.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		fm[field] = value;
	});
}

/** اگر با این ثبت محدوده‌ی کتاب تمام شد، آن را از میز مطالعه برمی‌دارد؛ true یعنی برداشته شد */
export async function finishIfDone(plugin: PomodoroPlugin, book: Book, to: number): Promise<boolean> {
	if (!plugin.settings.autoRemoveFinished || book.end == null || to < book.end) return false;
	const f = plugin.app.vault.getAbstractFileByPath(book.path);
	if (!(f instanceof TFile)) return false;
	await setOnDesk(plugin, f, false);
	return true;
}

/**
 * پس از حذف یک ثبت: اگر همان ثبت کتاب را تمام کرده بود و حالا دیگر تمام نیست،
 * کتاب را به میز مطالعه برمی‌گرداند. lastAfter آخرین صفحه‌ی ثبت‌شده‌ی کتاب پس از حذف است.
 */
export async function reopenIfUnfinished(
	plugin: PomodoroPlugin,
	name: string,
	deletedTo: number | null,
	lastAfter: number | null
): Promise<boolean> {
	const s = plugin.settings;
	if (!s.autoRemoveFinished || deletedTo == null) return false;
	const f = findBookFile(plugin, name);
	if (!f) return false;
	const fm = plugin.app.metadataCache.getFileCache(f)?.frontmatter;
	if (!fm || isTrue(fm[s.deskField])) return false;
	const end = num(fm[s.endField]);
	if (end == null || deletedTo < end) return false;
	const reached = lastAfter ?? num(fm[s.startField]) ?? 0;
	if (reached >= end) return false;
	await setOnDesk(plugin, f, true);
	return true;
}

/** انتقال فیلدهای قدیمی (فعال ← میز مطالعه، هفته ← دسته‌بندی)؛ تعداد یادداشت‌های تغییرکرده را برمی‌گرداند */
export async function migrateLegacy(plugin: PomodoroPlugin): Promise<number> {
	const { app, settings: s } = plugin;
	const LEGACY_DESK = "فعال";
	const LEGACY_GROUP = "هفته";
	let changed = 0;
	for (const f of bookFiles(plugin)) {
		const fm = app.metadataCache.getFileCache(f)?.frontmatter;
		if (!fm) continue;
		const moveDesk = s.deskField !== LEGACY_DESK && fm[LEGACY_DESK] !== undefined;
		const moveGroup = s.groupField !== LEGACY_GROUP && fm[LEGACY_GROUP] !== undefined;
		if (!moveDesk && !moveGroup) continue;
		await app.fileManager.processFrontMatter(f, (m: Record<string, unknown>) => {
			if (moveDesk) {
				if (m[s.deskField] === undefined) m[s.deskField] = isTrue(m[LEGACY_DESK]);
				delete m[LEGACY_DESK];
			}
			if (moveGroup) {
				if (m[s.groupField] === undefined) m[s.groupField] = m[LEGACY_GROUP];
				delete m[LEGACY_GROUP];
			}
		});
		changed++;
	}
	return changed;
}

/** ساخت یادداشت کتاب با فراداده‌ی صحیح؛ پس از ثبت‌شدن در کش متادیتا برمی‌گردد */
export async function createBook(plugin: PomodoroPlugin, data: NewBookData): Promise<void> {
	const { app, settings: s } = plugin;
	const folder = normalizePath(s.booksFolder);
	await ensureFolder(app, folder);
	const path = normalizePath(`${folder}/${data.name}.md`);
	if (app.vault.getAbstractFileByPath(path)) throw new Error("EXISTS");

	let resolve: () => void = () => undefined;
	const cached = new Promise<void>((r) => (resolve = r));
	const ref = app.metadataCache.on("changed", (f) => {
		if (f.path === path) resolve();
	});
	const timer = window.setTimeout(resolve, 1500);

	try {
		const file = await app.vault.create(path, "");
		await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm[s.bookTypeField] = s.bookTypeValue;
			fm[s.deskField] = data.onDesk;
			fm[s.startField] = data.start;
			if (data.end != null) fm[s.endField] = data.end;
			if (data.group) fm[s.groupField] = data.group;
		});
		await cached;
	} finally {
		window.clearTimeout(timer);
		app.metadataCache.offref(ref);
	}
}
