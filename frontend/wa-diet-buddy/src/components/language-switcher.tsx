import { Check, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LANGUAGES, LANGUAGE_META } from "@/lib/i18n/config";
import { useLanguage } from "@/lib/i18n/provider";

/**
 * The top bar's language control. Replaces the decorative "EN" button that had no onClick.
 *
 * Built on the app's DropdownMenu (Radix) so keyboard support comes for free and is the same as
 * every other menu here: Enter/Space to open, arrows to move, Enter to pick, Esc to dismiss.
 */
export function LanguageSwitcher() {
  const { t } = useTranslation("nav");
  const { language, setLanguage } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          aria-label={t("topbar.languageChange")}
        >
          <Languages className="h-4 w-4" />
          <span className="text-xs font-medium">{LANGUAGE_META[language].code}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>{t("topbar.language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((code) => (
          <DropdownMenuItem
            key={code}
            onSelect={() => setLanguage(code)}
            className="justify-between gap-4"
          >
            {/* The language's own name is rendered in that language's own direction, so
                "العربية" reads correctly even while the menu around it is still LTR. */}
            <span dir={LANGUAGE_META[code].dir}>{LANGUAGE_META[code].label}</span>
            {language === code ? (
              <Check className="h-4 w-4 text-primary" aria-hidden />
            ) : (
              <span className="h-4 w-4" aria-hidden />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
