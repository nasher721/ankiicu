"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  Settings2, 
  Palette, 
  Database, 
  Trash2, 
  AlertTriangle,
  Github,
  Info,
  CheckCircle2
} from "lucide-react";
import { useTheme } from "next-themes";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClearData = async () => {
    if (!confirm("WARNING: This will delete ALL cards and reset all progress. This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? Type 'yes' to confirm.")) return;
    
    try {
      await fetch("/api/cards", { method: "DELETE" });
      await fetch("/api/upload", { method: "DELETE" });
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      
      toast({ title: "All data cleared", description: "The application has been reset." });
      window.location.href = "/";
    } catch {
      toast({ title: "Failed to clear data", variant: "destructive" });
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure your AnkiICU preferences and manage your data.
        </p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize how AnkiICU looks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">
                Choose your preferred color scheme
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground capitalize">{theme}</span>
              <ThemeToggle />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Compact Mode</Label>
              <p className="text-sm text-muted-foreground">
                Reduce spacing for denser UI
              </p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Generation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Generation Defaults
          </CardTitle>
          <CardDescription>
            Default settings for card generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-save cards</Label>
              <p className="text-sm text-muted-foreground">
                Automatically save generated cards
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notify on completion</Label>
              <p className="text-sm text-muted-foreground">
                Show notification when generation completes
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Data Management
          </CardTitle>
          <CardDescription>
            Manage your local data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-900 dark:text-red-200">Clear All Data</p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Delete all cards, source files, and reset progress. This cannot be undone.
                </p>
              </div>
            </div>
            <Button variant="destructive" onClick={handleClearData}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            About AnkiICU
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">Version</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">Built with</span>
            <div className="flex gap-2">
              <Badge variant="secondary">Next.js</Badge>
              <Badge variant="secondary">TypeScript</Badge>
              <Badge variant="secondary">AI</Badge>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">Source</span>
            <Button variant="link" className="h-auto p-0" asChild>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
