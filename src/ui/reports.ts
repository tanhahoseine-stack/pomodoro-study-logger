import type PomodoroPlugin from "../../main";
import { I18nKey, t } from "../i18n";
import { levelOf, Snapshot, Totals } from "../stats";
import { addDays, dateKey, faNum, fmtDate, keyToDate, weekStartOf } from "../utils";

/** نمایش دقیقه به‌صورت «۲ ساعت و ۱۵ دقیقه» */
export function fmtMinutes(min: number): string {
	if (min < 60) return t("minutes", { n: faNum(min) });
	const h = Math.floor(min / 60);
	const m = min % 60;
	return m ? t("hoursMinutes", { h: faNum(h), m: faNum(m) }) : t("hours", { h: faNum(h) });
}

/** تب «گزارش‌ها»: مطالعه و زمان پومودورو در روز، هفته، ماه و کل */
export function renderStats(panel: HTMLElement, _p: PomodoroPlugin, snap: Snapshot): void {
	const st = snap.stats;
	panel.createEl("b", { text: t("statsTitle") });

	const table = panel.createEl("table", { cls: "psl-table" });
	const head = table.createEl("thead").createEl("tr");
	head.createEl("th");
	for (const k of ["colPoms", "colTime", "colPages"] as I18nKey[]) head.createEl("th", { text: t(k) });

	const body = table.createEl("tbody");
	const rows: [I18nKey, Totals][] = [
		["rowToday", st.today],
		["rowWeek", st.week],
		["rowMonth", st.month],
		["rowTotal", st.total],
	];
	for (const [label, v] of rows) {
		const tr = body.createEl("tr");
		tr.createEl("th", { text: t(label), attr: { scope: "row" } });
		tr.createEl("td", { text: faNum(v.poms) });
		tr.createEl("td", { text: fmtMinutes(v.minutes) });
		tr.createEl("td", { text: faNum(v.pages) });
	}
}

function card(parent: HTMLElement, icon: string, label: string, value: string, sub = ""): void {
	const c = parent.createDiv({ cls: "psl-card" });
	c.createDiv({ cls: "psl-card-label", text: `${icon} ${label}` });
	c.createDiv({ cls: "psl-card-value", text: value });
	if (sub) c.createDiv({ cls: "psl-sub", text: sub });
}

/** تب «استمرار»: زنجیره، رکورد، کاپ‌ها و نقشه‌ی گرمایی */
export function renderStreak(panel: HTMLElement, p: PomodoroPlugin, snap: Snapshot): void {
	const s = p.settings;
	const st = snap.stats.streak;
	const cupEvery = Math.max(1, s.cupEveryDays);

	const cards = panel.createDiv({ cls: "psl-cards" });
	card(cards, "🔥", t("streakCurrent"), t("days", { n: faNum(st.current) }));
	card(
		cards,
		"🏆",
		t("streakRecord"),
		t("days", { n: faNum(st.record) }),
		st.recordEnd ? t("recordOn", { date: fmtDate(keyToDate(st.recordEnd), s.useJalali) }) : ""
	);
	card(
		cards,
		"🥇",
		t("cups"),
		st.cups ? "🏆".repeat(Math.min(st.cups, 8)) + (st.cups > 8 ? ` ×${faNum(st.cups)}` : "") : t("cupsNone"),
		t("cupsHint", { n: faNum(cupEvery) })
	);

	// پیشرفت تا کاپ بعدی
	const into = st.current % cupEvery;
	const full = st.current > 0 && into === 0;
	const filled = full ? cupEvery : into;
	const chain = panel.createDiv({
		cls: "psl-chain",
		attr: { role: "img", "aria-label": `${filled}/${cupEvery}` },
	});
	for (let i = 0; i < cupEvery; i++) chain.createSpan({ cls: "psl-dot" + (i < filled ? " psl-dot-on" : "") });
	chain.createSpan({ cls: "psl-chain-cup", text: "🏆" });

	let hint: string;
	if (st.current === 0) hint = t("streakNone");
	else if (full) hint = t("cupJustEarned");
	else hint = t("nextCup", { n: faNum(cupEvery - into) });
	if (st.current > 0 && !st.todayDone) hint += " " + t("keepChain");
	panel.createDiv({ cls: "psl-sub", text: hint, attr: { "aria-live": "polite" } });

	renderHeatmap(panel, p, snap);
}

/** نقشه‌ی گرمایی؛ هر ستون یک هفته (قدیمی‌ترین سمت راست)، هر ردیف یک روز هفته */
function renderHeatmap(panel: HTMLElement, p: PomodoroPlugin, snap: Snapshot): void {
	const s = p.settings;
	const weeks = Math.min(53, Math.max(4, s.heatmapWeeks));
	panel.createEl("b", { text: t("heatTitle"), cls: "psl-heat-title" });

	const grid = panel.createDiv({ cls: "psl-heat", attr: { role: "img", "aria-label": t("heatTitle") } });
	grid.style.gridTemplateColumns = `repeat(${weeks}, 1fr)`;
	grid.style.maxWidth = `${weeks * 24}px`;

	const now = new Date();
	now.setHours(12, 0, 0, 0);
	const todayKey = dateKey(now);
	const start = addDays(weekStartOf(now, s.weekStart), -(weeks - 1) * 7);

	for (let i = 0; i < weeks * 7; i++) {
		const d = addDays(start, i);
		const key = dateKey(d);
		if (key > todayKey) {
			grid.createDiv({ cls: "psl-cell psl-future" });
			continue;
		}
		const poms = snap.stats.days.get(key)?.poms ?? 0;
		const date = fmtDate(d, s.useJalali);
		const tip = poms ? t("cellTip", { date, n: faNum(poms) }) : t("cellTipNone", { date });
		grid.createDiv({
			cls: `psl-cell psl-lv${levelOf(poms, s.goalPomodoros)}`,
			attr: { title: tip, "aria-label": tip },
		});
	}

	const legend = panel.createDiv({ cls: "psl-legend" });
	legend.createSpan({ cls: "psl-sub", text: t("legendLess") });
	for (let lv = 0; lv <= 4; lv++) legend.createSpan({ cls: `psl-cell psl-lv${lv}` });
	legend.createSpan({ cls: "psl-sub", text: t("legendMore") });
}
