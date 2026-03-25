import { useState, useEffect } from "react";

const STORAGE_KEY = "openai_api_key";
/** Legacy key from Z.ai / GLM — migrated once on read */
const LEGACY_STORAGE_KEY = "zai_api_key";

export function useApiKey() {
  const [key, setKeyState] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Read from localStorage only after component mounts (client-side)
    try {
      let storedKey = localStorage.getItem(STORAGE_KEY);
      if (!storedKey) {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          localStorage.setItem(STORAGE_KEY, legacy);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          storedKey = legacy;
        }
      }
      if (storedKey) {
        setKeyState(storedKey);
      }
    } catch (error) {
      console.error("Error accessing localStorage:", error);
    }
    setIsReady(true);

    // Optional: listen to storage events to sync across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setKeyState(e.newValue);
      }
    };
    
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const setKey = (newKey: string) => {
    setKeyState(newKey);
    try {
      localStorage.setItem(STORAGE_KEY, newKey);
    } catch (error) {
      console.error("Error writing to localStorage:", error);
    }
  };

  const clearKey = () => {
    setKeyState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Error removing from localStorage:", error);
    }
  };

  return {
    key,
    isReady,
    setKey,
    clearKey,
  };
}
