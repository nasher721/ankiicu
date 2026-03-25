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
import { useApiKey } from "@/hooks/use-api-key";

interface ApiKeyModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

export function ApiKeyModal({ isOpen, onOpenChange, onSave }: ApiKeyModalProps) {
  const { setKey } = useApiKey();
  const [inputValue, setInputValue] = useState("");

  const handleSave = () => {
    if (inputValue.trim()) {
      setKey(inputValue.trim());
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
            You need a Z.ai (GLM) API key to generate flashcards. This key is stored securely in your browser's local storage and is never saved to our database.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter API key"
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
