import type { PomRow } from "./history";
import type { PluginSettings } from "./settings";
import { dateKey, keyToDate, monthKey, weekStartOf } from "./utils";

export type Tab = "log" | "stats" | "streak";

export interface Totals {
	poms: number;
	pages: number;
	minutes: number;
}

export interface DayInfo {
	poms: number;
	pages: number;
}

export interface StreakInfo {
	current: number; // زنجیره‌ی فعلی (روز)
	record: number; // رکورد استمرار
	recordEnd: string | null; // تاریخ پایان رکورد (YYYY-MM-DD)
	cups: number; // تعداد کاپ‌های گرفته‌شده
	todayDone: boolean; // آیا امروز شرط حداقل پومودورو برقرار است؟
}

export interface Stats {
	today: Totals;
	week: Totals;
	month: Totals;
	total: Totals;
	days: Map<string, DayInfo>;
	streak: StreakInfo;
}

export interface Snapshot {
	rows: PomRow[];
	stats: Stats;
}

const pagesOf = (r: PomRow): number => (r.from != null && r.to != null && r.to > r.from ? r.to - r.from : 0);

const dayIndex = (key: string): number => {
	const [y, m, d] = key.split("-").map(Number);
	return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

const zero = (): Totals => ({ poms: 0, pages: 0, minutes: 0 });

/** سطح شدت (۰ تا ۴) برای رنگ‌آمیزی نقشه‌ی گرمایی نسبت به هدف روزانه */
export function levelOf(poms: number, goal: number): number {
	if (poms <= 0) return 0;
	return Math.min(4, Math.max(1, Math.ceil((poms / Math.max(1, goal)) * 4)));
}

/** محاسبه‌ی گزارش‌ها (روز/هفته/ماه/کل) و زنجیره‌ی استمرار از روی تاریخچه */
export function computeStats(rows: PomRow[], s: PluginSettings, now: Date): Stats {
	const days = new Map<string, DayInfo>();
	for (const r of rows) {
		const d = days.get(r.key) ?? { poms: 0, pages: 0 };
		d.poms++;
		d.pages += pagesOf(r);
		days.set(r.key, d);
	}

	const todayKey = dateKey(now);
	const weekKey = dateKey(weekStartOf(now, s.weekStart));
	const monthNow = monthKey(now, s.useJalali);
	const today = zero();
	const week = zero();
	const month = zero();
	const total = zero();
	const add = (t: Totals, v: DayInfo) => {
		t.poms += v.poms;
		t.pages += v.pages;
	};
	for (const [key, v] of days) {
		add(total, v);
		if (key === todayKey) add(today, v);
		const d = keyToDate(key);
		if (dateKey(weekStartOf(d, s.weekStart)) === weekKey) add(week, v);
		if (monthKey(d, s.useJalali) === monthNow) add(month, v);
	}
	for (const t of [today, week, month, total]) t.minutes = t.poms * s.pomMinutes;

	// ----- زنجیره‌ی استمرار -----
	const cupEvery = Math.max(1, s.cupEveryDays);
	const keys = [...days.entries()]
		.filter(([, v]) => v.poms >= s.streakMinPoms)
		.map(([k]) => k)
		.sort();

	let record = 0;
	let recordEnd: string | null = null;
	let cups = 0;
	let runLen = 0;
	let prevIdx = -1e9;
	let lastLen = 0;
	let lastEndIdx = -1e9;
	for (const key of keys) {
		const ix = dayIndex(key);
		runLen = ix === prevIdx + 1 ? runLen + 1 : 1;
		prevIdx = ix;
		if (runLen % cupEvery === 0) cups++;
		if (runLen >= record) {
			record = runLen;
			recordEnd = key;
		}
		lastLen = runLen;
		lastEndIdx = ix;
	}
	// تا پایان امروز زنجیره نشکسته است؛ اگر آخرین روز ثبت دیروز باشد هنوز زنده است
	const todayIdx = dayIndex(todayKey);
	const current = lastEndIdx >= todayIdx - 1 ? lastLen : 0;
	const todayDone = (days.get(todayKey)?.poms ?? 0) >= s.streakMinPoms;

	return { today, week, month, total, days, streak: { current, record, recordEnd, cups, todayDone } };
}
