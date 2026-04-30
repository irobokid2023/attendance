import { useEffect, useState } from "react";
import { Check, X, AlertCircle, Smartphone, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type CheckItem = {
  label: string;
  passed: boolean;
  hint?: string;
};

const PRODUCTION_HOST = "irobokidattendance.lovable.app";

const PWAInstallChecklist = () => {
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [allPassed, setAllPassed] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    const isHttps = window.location.protocol === "https:";
    const isPreview =
      host.includes("id-preview--") || host.includes("lovableproject.com");
    const isProductionHost =
      host === PRODUCTION_HOST || (!isPreview && host !== "localhost");

    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;

    const hasSW = "serviceWorker" in navigator;
    const hasManifest = !!document.querySelector('link[rel="manifest"]');

    const items: CheckItem[] = [
      {
        label: "Visiting the production URL",
        passed: isProductionHost,
        hint: `Open ${PRODUCTION_HOST} instead of the preview link.`,
      },
      {
        label: "Served over HTTPS",
        passed: isHttps,
        hint: "The install prompt requires a secure (HTTPS) connection.",
      },
      {
        label: "Not opened inside an iframe",
        passed: !inIframe,
        hint: "Open the site directly in your browser, not inside the editor.",
      },
      {
        label: "Browser supports service workers",
        passed: hasSW,
        hint: "Use Google Chrome, Edge, or Samsung Internet on Android.",
      },
      {
        label: "Web app manifest detected",
        passed: hasManifest,
      },
    ];

    setChecks(items);
    const passed = items.every((c) => c.passed);
    setAllPassed(passed);
    // Auto-expand when something is wrong (and not already installed)
    if (!passed && !isStandalone) setOpen(true);
  }, []);

  // Hide the checklist entirely when running as installed PWA
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true);
  if (isStandalone) return null;

  return (
    <Card className="mt-4 border-border/60 shadow-sm overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-accent/30 transition-colors">
          <div className="flex items-center gap-2 min-w-0">
            <Smartphone className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                Install on your phone
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {allPassed
                  ? "All checks passed — install option should appear in Chrome."
                  : "Some checks failed — tap to see what's needed."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {allPassed ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-600 dark:text-green-500">
                <Check className="w-3 h-3" /> Ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-500">
                <AlertCircle className="w-3 h-3" /> Action needed
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 space-y-2 border-t border-border/60">
            {checks.map((c) => (
              <div key={c.label} className="flex items-start gap-2">
                <div
                  className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                    c.passed
                      ? "bg-green-500/15 text-green-600 dark:text-green-500"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {c.passed ? (
                    <Check className="w-2.5 h-2.5" />
                  ) : (
                    <X className="w-2.5 h-2.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-foreground leading-tight">
                    {c.label}
                  </p>
                  {!c.passed && c.hint && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {c.hint}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
              On Android Chrome: open the menu (⋮) and tap{" "}
              <strong>Install app</strong> or <strong>Add to Home screen</strong>.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default PWAInstallChecklist;
