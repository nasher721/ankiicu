import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ApiKeyModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Must be the same setter as the parent `useApiKey()` so React state stays in sync (localStorage alone does not update other hook instances in the same tab). */
  setKey: (key: string) => void;
  onSave?: () => void;
}

export function ApiKeyModal({ isOpen, onOpenChange, setKey, onSave }: ApiKeyModalProps) {
  const [inputValue, setInputValue] = useState("");

  const handleSave = () => {
    if (inputValue.trim()) {
      const trimmed = inputValue.trim();
      setKey(trimmed);
      setInputValue("");
      onOpenChange(false);
      onSave?.();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter your AI API Key</DialogTitle>
          <DialogDescription>
            Add your OpenAI API key to generate flashcards. Get one at{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              platform.openai.com/api-keys
            </a>
            . The key stays in your browser (local storage only) and is not stored in our database.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="sk-..."
              autoComplete="off"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter className="flex space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!inputValue.trim()}>
            Save & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
