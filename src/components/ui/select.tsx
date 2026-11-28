import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "cn";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string = string> {
  id?: string;
  value: T;
  onValueChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Select<T extends string = string>({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((opt) => opt.value === value);

  function updateScrollIndicators() {
    const el = listRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 2);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const flipUp = spaceBelow < 220 && spaceAbove > spaceBelow;

      if (flipUp) {
        setMenuStyle({
          bottom: window.innerHeight - rect.top + 6,
          left: rect.left,
          width: rect.width,
          maxHeight: Math.min(260, Math.max(120, spaceAbove)),
        });
      } else {
        setMenuStyle({
          top: rect.bottom + 6,
          left: rect.left,
          width: rect.width,
          maxHeight: Math.min(260, Math.max(120, spaceBelow)),
        });
      }
    }

    updatePosition();
    const raf = requestAnimationFrame(updateScrollIndicators);

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, options.length]);

  return (
    <div className={cn("relative w-full", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-4xl border border-input bg-input/30 px-3 py-1 text-sm transition-colors outline-none",
          "hover:bg-input/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open &&
        menuStyle &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: menuStyle.top,
              bottom: menuStyle.bottom,
              left: menuStyle.left,
              width: menuStyle.width,
            }}
            className="z-[100] relative overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg"
          >
            {canScrollUp && (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-popover to-transparent" />
            )}

            <div
              ref={listRef}
              onScroll={updateScrollIndicators}
              style={{ maxHeight: menuStyle.maxHeight }}
              className="overflow-y-auto overflow-x-hidden p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {options.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No options available
                </div>
              ) : (
                options.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onValueChange(opt.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                        isSelected
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <Check className="size-3.5 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            {canScrollDown && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-popover to-transparent" />
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
