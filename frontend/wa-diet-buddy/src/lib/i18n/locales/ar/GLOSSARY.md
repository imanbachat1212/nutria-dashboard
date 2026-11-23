# Arabic UI glossary — Nutria

Modern Standard Arabic (MSA), gender-neutral where the grammar allows, short UI wording.
Every term below is fixed vocabulary: if a string in this folder uses one of these concepts it
must use this exact wording, so the same thing is never called two names across screens.

## Agreed terms (from the brief)

| English | Arabic |
| --- | --- |
| dietitian | اختصاصي/ة تغذية |
| client | عميل |
| meal plan | خطة غذائية |
| journal | سجل الطعام |
| appointments | المواعيد |
| messages | الرسائل |
| leads | عملاء محتملون |
| calories | سعرات حرارية |
| protein | بروتين |
| carbs | كربوهيدرات |
| fat | دهون |
| pending | قيد المراجعة |
| approved | تمت الموافقة |
| rejected | مرفوض |
| flagged | بحاجة لانتباه |
| owner | المالك |

## Terms chosen here — NOT from the brief, need a native speaker's review

These were picked to fill gaps. They are the ones to argue about.

| English | Arabic used | Note |
| --- | --- | --- |
| Overview (dashboard) | نظرة عامة | |
| Team & Access | الفريق والصلاحيات | lit. "team and permissions" |
| Permissions | الصلاحيات | |
| Role | الدور | |
| Invite / Invitation | دعوة | |
| Suspended | موقوف | of an account, not a person |
| Reactivate | إعادة تنشيط | |
| Remove (from team) | إزالة | distinct from حذف (delete) |
| Meal Library | مكتبة الوجبات | |
| Meal Templates | قوالب الخطط | lit. "plan templates" |
| Food Database | قاعدة بيانات الأطعمة | |
| Intake / intake form | استبيان الالتحاق | |
| Journal Review | مراجعة سجل الطعام | |
| Entry (journal) | مدخل | |
| Serving | حصة | |
| Snack | وجبة خفيفة | |
| Breakfast / Lunch / Dinner | فطور / غداء / عشاء | |
| Low confidence | ثقة منخفضة | of the AI match |
| Needs review | بحاجة لمراجعة | |
| Target (daily) | الهدف اليومي | |
| Adherence | الالتزام | |
| Booking | حجز | |
| No-show | عدم حضور | |
| Consultation | استشارة | |
| Follow-up | متابعة | |
| Reception | الاستقبال | the role |
| Accountant | المحاسب | the role |
| Intern | متدرب | the role |
| Billing | الفواتير | |
| Reports | التقارير | |
| Settings | الإعدادات | |
| Website / CMS | الموقع الإلكتروني | |
| Last active | آخر نشاط | |
| Last login | آخر تسجيل دخول | |
| Archived | مؤرشف | |
| Lead (sales) | عميل محتمل | singular of عملاء محتملون |

## Added while translating — the ones most worth a second opinion

These were coined during the work and are the likeliest to read oddly to a Lebanese dietitian.

| English | Arabic used | Why it is uncertain |
| --- | --- | --- |
| AI autopilot | الرد التلقائي بالذكاء الاصطناعي | Literal and long ("automatic reply by AI"). A shorter coinage may read better in the thread header. |
| Approve all clean | الموافقة على كل المدخلات السليمة | "سليمة" = sound/clean. Could also be "الخالية من التنبيهات". |
| Clean entry | مدخل سليم | Same question as above. |
| Flagged | بحاجة لانتباه | From the brief. Note it is a phrase, not an adjective, so it does not inflect with the noun — check it still reads correctly in "4 مدخلات بحاجة لانتباه". |
| Low confidence | ثقة منخفضة | Of the AI's parse, not the client. |
| No login | لم يسجّل دخولًا | Of a staff account that has never signed in. |
| Suspend access | إيقاف الوصول | vs. "تعليق الحساب". |
| Audit log | سجل التغييرات | Literally "change log"; "سجل التدقيق" is the more formal audit term. |
| Try out (class) | حصة تجريبية | |
| Reformer / HIIT / Spin | left in Latin | Gym class names; left as-is because that is how they are marketed. |
| Journal entry | مدخل | Short on purpose — it appears in dense counted strings. "تدوينة" was rejected as blog-flavoured. |
| Over daily target | تجاوز الهدف اليومي | An AI flag reason. |
| Items estimated by AI | عناصر مُقدّرة بالذكاء الاصطناعي | An AI flag reason; long for a badge. |
| Quick replies (message bodies) | عمل رائع! / إرسال خطة اليوم / … | These are SENT TO CLIENTS over WhatsApp, so the wording matters more than UI copy. Please review as client-facing text, not as labels. |
| BMR / TDEE / BMI / DRI / PES / ADIME | kept as Latin acronyms | Lebanese dietitians use them untranslated in conversation, and the Arabic expansions do not fit the label columns. Flagged in case you disagree. |
| kcal / g / ml / kg / cm | kept as Latin units | Same reasoning; also keeps macro rows scannable. |

## Conventions

- **Digits stay Western (0-9)** in both languages — see `lib/i18n/format.ts`. Do not write
  Arabic-Indic numerals into these files.
- **Units stay short and Latin** where the practice already reads them that way: `kcal`, `g`.
  Translating `g` to `جم` was considered and rejected as less legible on a dense macro row.
- **Plurals**: Arabic needs all six CLDR categories. Any counted string must supply
  `_zero _one _two _few _many _other`. `npm run i18n:check` fails the build if one is missing.
- **User data is never translated**: client names, food and recipe names, WhatsApp message
  bodies, coach notes. Server error text is shown as the server sends it (English for now).
