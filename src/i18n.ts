/**
 * متن‌های رابط کاربری. فعلاً فقط فارسی؛ برای افزودن زبان جدید کافی است
 * یک دیکشنری دیگر اضافه و `current` را تغییر دهی.
 */
const fa = {
	ribbon: "ثبت پومودورو مطالعه",
	cmdOpen: "باز کردن ثبت پومودورو (حالت پیش‌فرض)",
	cmdModal: "ثبت پومودورو در پنجره‌ی شناور",
	cmdSidebar: "ثبت پومودورو در سایدبار",
	cmdCodeblock: "درج Code Block ثبت پومودورو در یادداشت",
	cmdAddBook: "افزودن کتاب جدید",
	noEditor: "ابتدا یک یادداشت را در حالت ویرایش باز کن.",

	// فرم ثبت
	formTitle: "🍅 ثبت پومودورو",
	todaySummary: "امروز: {poms} از {goal} پومودورو · {pages} صفحه",
	tabLog: "ثبت",
	tabStats: "گزارش‌ها",
	tabStreak: "استمرار",
	book: "📖 کتاب",
	chooseBook: "— انتخاب کتاب —",
	fromLabel: "صفحه‌ی شروع",
	toLabel: "صفحه‌ی پایان",
	toPlaceholder: "تا کجا رسیدی؟",
	pickBookHint: "یک کتاب انتخاب کن؛ صفحه‌ی شروع خودکار پر می‌شود.",
	range: "محدوده: ص {s} تا {e}",
	pagesChip: "📄 {n} صفحه",
	endGtStart: "⚠️ صفحه‌ی پایان باید بیشتر از شروع باشد",
	overRange: "⚠️ از انتهای محدوده (ص {e}) گذشتی",
	remaining: "📖 {n} صفحه تا انتهای محدوده",
	save: "✅ ثبت پومودورو",
	saving: "در حال ثبت…",
	addBook: "➕ افزودن کتاب",
	needBook: "⚠️ اول کتاب را انتخاب کن.",
	needPages: "⚠️ صفحه‌ی شروع و پایان را وارد کن.",
	saved: "✅ ثبت شد: {book} — ص {from} تا {to} ({n} صفحه) · پومودورو {p} از {goal}",
	goalDone: " 🎉 هدف امروز کامل شد!",
	bookFinished: " · 📕 کتاب «{book}» تمام شد و از میز مطالعه برداشته شد.",
	cupEarned: " · 🏆 {n} روز استمرار! یک کاپ جدید گرفتی.",
	recordNew: " · 🔥 رکورد جدید: {n} روز پیاپی.",
	saveError: "⚠️ خطا در ثبت: {msg}",
	noBooks:
		"هیچ کتابی روی میز مطالعه نیست. با دکمه‌ی «➕ افزودن کتاب» کتاب جدید بساز، یا در یادداشت کتاب گزینه‌ی «میز مطالعه» را روشن کن.",
	formError: "⚠️ خطا در فرم ثبت پومودورو: {msg}",

	// حذف ثبت
	recentTitle: "آخرین ثبت‌ها",
	recentHint: "ثبت اشتباه شد؟ دکمه‌ی حذف کنار آن را بزن؛ صفحه‌ی شروع کتاب هم برمی‌گردد.",
	recentEmpty: "هنوز پومودوروی ثبت‌شده‌ای نیست.",
	recentItem: "{book} — ص {from} تا {to}",
	today: "امروز",
	del: "🗑 حذف",
	delAria: "حذف پومودورو: {desc}",
	confirmTitle: "حذف پومودورو",
	confirmBody: "این ثبت حذف شود؟\n{desc}\n({date})",
	confirmYes: "بله، حذف شود",
	confirmNo: "انصراف",
	removed: "🗑 حذف شد: {desc}",
	removedReopen: " · کتاب دوباره به میز مطالعه برگشت.",
	removeError: "⚠️ خطا در حذف: {msg}",
	removeChanged: "خط پومودورو در یادداشت تغییر کرده است؛ فرم را تازه کن و دوباره تلاش کن.",
	fileMissing: "یادداشت روزانه‌ی این ثبت پیدا نشد.",

	// افزودن کتاب
	addBookTitle: "➕ افزودن کتاب جدید",
	bookName: "نام کتاب",
	bookNameDesc: "نام یادداشت کتاب؛ نویسه‌های غیرمجاز در نام فایل حذف می‌شوند.",
	startPage: "صفحه‌ی ابتدا",
	endPage: "صفحه‌ی انتها",
	endPageDesc: "اختیاری؛ وقتی به این صفحه برسی، کتاب از میز مطالعه برداشته می‌شود.",
	groupName: "دسته‌بندی",
	groupNameDesc: "اختیاری؛ هر چه خودت می‌خواهی بنویس (پیشنهاد: هفته اول).",
	groupPlaceholder: "مثلاً: هفته اول",
	onDesk: "میز مطالعه",
	onDeskDesc: "اگر روشن باشد، کتاب در فهرست ثبت پومودورو نمایش داده می‌شود.",
	create: "ساخت کتاب",
	bookNameEmpty: "نام کتاب را وارد کن.",
	bookInvalidRange: "صفحه‌ی انتها باید بیشتر از صفحه‌ی ابتدا باشد.",
	bookExists: "کتابی با این نام از قبل وجود دارد.",
	bookCreated: "کتاب «{name}» ساخته شد.",
	bookError: "خطا در ساخت کتاب: {msg}",

	// گزارش‌ها
	statsTitle: "گزارش مطالعه و زمان",
	colPoms: "پومودورو",
	colTime: "زمان مطالعه",
	colPages: "صفحه",
	rowToday: "امروز",
	rowWeek: "این هفته",
	rowMonth: "این ماه",
	rowTotal: "کل",
	minutes: "{n} دقیقه",
	hours: "{h} ساعت",
	hoursMinutes: "{h} ساعت و {m} دقیقه",

	// استمرار
	streakCurrent: "زنجیره‌ی فعلی",
	streakRecord: "رکورد استمرار",
	cups: "کاپ‌ها",
	days: "{n} روز",
	recordOn: "تا {date}",
	nextCup: "{n} روز دیگر تا کاپ بعدی 🏆",
	cupJustEarned: "🏆 به کاپ رسیدی! همین‌طور ادامه بده.",
	keepChain: "امروز هنوز ثبت نکردی؛ یک پومودورو بزن تا زنجیره نشکند.",
	streakNone: "زنجیره‌ای شروع نشده؛ امروز اولین پومودورو را ثبت کن.",
	cupsHint: "هر {n} روز پیاپی مطالعه = یک کاپ",
	cupsNone: "هنوز کاپی نگرفته‌ای",
	heatTitle: "نقشه‌ی گرمایی فعالیت",
	legendLess: "کم",
	legendMore: "زیاد",
	cellTip: "{date}: {n} پومودورو",
	cellTipNone: "{date}: بدون ثبت",

	sidebarTitle: "ثبت پومودورو",
	invalidTemplate: "قالب خط پومودورو باید شامل {{book}}، {{from}} و {{to}} باشد.",
};

export type I18nKey = keyof typeof fa;
const current: Record<I18nKey, string> = fa;

/** گرفتن متن با جایگذاری متغیرها: t("x", { n: 3 }) */
export function t(key: I18nKey, vars?: Record<string, string | number>): string {
	let s = current[key];
	if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
	return s;
}
