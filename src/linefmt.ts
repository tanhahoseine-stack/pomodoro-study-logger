import { bookKey, escapeRegExp, num } from "./utils";

export const REQUIRED_PLACEHOLDERS = ["{{book}}", "{{from}}", "{{to}}"];

export function validateTemplate(tpl: string): boolean {
	return REQUIRED_PLACEHOLDERS.every((k) => tpl.includes(k));
}

export interface ParsedPom {
	book: string;
	from: number | null;
	to: number | null;
}

type FieldName = "book" | "from" | "to";

/**
 * قالب خط پومودورو را به الگوهای regex تبدیل می‌کند تا هم نوشتن و هم خواندن
 * (تاریخچه، آمار روزانه، پر کردن جای خالی) با یک منبع واحد انجام شود.
 */
export class LineFormat {
	private body: string;
	private labels: Record<FieldName, string> = { book: "کتاب", from: "از", to: "تا" };
	private doneRe: RegExp;
	private anyRe: RegExp;
	private emptyRe: RegExp;

	constructor(template: string) {
		this.body = template.replace(/^\s*[-*+]\s*\[.\]\s*/, "").trim();

		// نام برچسب فیلدها را از خود قالب بیرون می‌کشیم: [کتاب:: {{book}}]
		const re = /\[([^[\]:]+?)::\s*\{\{(book|from|to)\}\}\s*\]/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(this.body))) this.labels[m[2] as FieldName] = m[1].trim();

		const marker = escapeRegExp(this.body.split("{{")[0].trim());
		this.doneRe = new RegExp(`^\\s*[-*+]\\s*\\[[xX]\\]\\s*${marker}`);
		this.anyRe = new RegExp(`^\\s*[-*+]\\s*\\[.\\]\\s*${marker}`);

		// الگوی خطِ خالی: همان قالب با مقدارهای تهی و چک‌باکس خالی
		const pattern = this.body
			.split(/(\{\{\w+\}\})/)
			.map((part) => {
				const ph = part.match(/^\{\{(\w+)\}\}$/);
				if (ph) return ph[1] === "index" ? "(?<idx>\\S*)" : "\\s*";
				return escapeRegExp(part).replace(/\s+/g, "\\s*");
			})
			.join("");
		this.emptyRe = new RegExp(`^(?<indent>\\s*)[-*+]\\s*\\[\\s\\]\\s*${pattern}\\s*$`);
	}

	/** آیا خط، پومودوروی انجام‌شده است؟ */
	isDone(line: string): boolean {
		return this.doneRe.test(line);
	}

	/** آیا خط، چک‌لیست پومودورو (انجام‌شده یا نه) است؟ */
	isAny(line: string): boolean {
		return this.anyRe.test(line);
	}

	/** اگر خط، جای خالی پومودورو باشد، تورفتگی و برچسب شماره را برمی‌گرداند */
	matchEmpty(line: string): { indent: string; index: string } | null {
		const m = line.match(this.emptyRe);
		if (!m) return null;
		return { indent: m.groups?.indent ?? "", index: m.groups?.idx ?? "" };
	}

	/** ساخت خط انجام‌شده */
	render(indent: string, index: string, book: string, from: number, to: number): string {
		const body = this.body
			.replace(/\{\{index\}\}/g, index)
			.replace(/\{\{book\}\}/g, book)
			.replace(/\{\{from\}\}/g, String(from))
			.replace(/\{\{to\}\}/g, String(to));
		return `${indent}- [x] ${body}`;
	}

	private field(line: string, label: string): string | null {
		const re = new RegExp(`\\[${escapeRegExp(label)}::\\s*((?:\\[\\[.*?\\]\\]|[^\\]])*)\\]`);
		const m = line.match(re);
		return m ? m[1].trim() : null;
	}

	/** خواندن کتاب و صفحات از یک خط انجام‌شده */
	parse(line: string): ParsedPom | null {
		if (!this.isDone(line)) return null;
		return {
			book: bookKey(this.field(line, this.labels.book)),
			from: num(this.field(line, this.labels.from)),
			to: num(this.field(line, this.labels.to)),
		};
	}
}
