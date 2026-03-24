"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeToggle } from "./theme-toggle";
import { 
  LayoutDashboard, 
  Upload, 
  Sparkles, 
  Library, 
  Download,
  GraduationCap,
  Brain,
  ChevronLeft,
  ChevronRight,
  Settings,
  LogIn,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    description: "Overview & stats",
  },
  {
    title: "Upload",
    href: "/upload",
    icon: Upload,
    description: "Import textbooks",
  },
  {
    title: "Generate",
    href: "/generate",
    icon: Sparkles,
    description: "AI card creation",
  },
  {
    title: "Cards",
    href: "/cards",
    icon: Library,
    description: "Manage & edit cards",
  },
  {
    title: "Export",
    href: "/export",
    icon: Download,
    description: "Export to Anki",
  },
  {
    title: "Study",
    href: "/study",
    icon: GraduationCap,
    description: "Preview & study",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-card transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">AnkiICU</span>
          </Link>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary mx-auto">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCollapsed(true)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 absolute -right-4 top-6 bg-background border shadow-sm"
            onClick={() => setCollapsed(false)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="grid gap-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive 
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" 
                    : "text-muted-foreground",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.title : undefined}
              >
                <Icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-primary-foreground")} />
                {!collapsed && (
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium leading-none">{item.title}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">{item.description}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-4">
        <div
          className={cn(
            "flex items-center gap-1",
            collapsed ? "flex-col justify-center" : "justify-between",
          )}
        >
          <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild title="Sign in">
              <Link href="/login">
                <LogIn className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" asChild title="Settings">
              <Link href="/settings">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
