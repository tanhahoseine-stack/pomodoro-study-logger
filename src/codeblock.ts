import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import type PomodoroPlugin from "../main";
import type { Tab } from "./stats";
import { PomodoroForm } from "./ui/form";

export const CODEBLOCK_ID = "pomodoro-logger";

/**
 * ثبت پردازشگر Code Block با شناسه‌ی `pomodoro-logger`.
 * بدون پارامتر: فرم کامل با تب‌ها. برای نمایش فقط یک بخش، داخل بلوک بنویس:
 *   tab: log | stats | streak
 */
export function registerCodeBlock(plugin: PomodoroPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		CODEBLOCK_ID,
		(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			ctx.addChild(new MarkdownRenderChild(el));
			const m = source.match(/^\s*tab\s*:\s*(log|stats|streak)\s*$/m);
			const only = m ? (m[1] as Tab) : null;
			const form = new PomodoroForm(plugin, el.createDiv(), only);
			void form.render();
		}
	);
}
