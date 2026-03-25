# AI API Key Modal Design

## Overview
This document outlines the design for allowing users to input their own AI API Key (specifically for Z.ai/GLM-5) to generate Anki flashcards. The key will be stored locally in the browser's `localStorage` and sent with requests, ensuring security and avoiding the need for a full user authentication system.

## 1. Architecture & UI Data Flow
- **Component:** A new `ApiKeyModal` component built with shadcn/ui's `Dialog`.
- **Location:** The modal will be triggered on the `/generate` page.
- **State Management:** A custom React hook `useApiKey()` will be created to read from and write to the browser's `localStorage` safely (handling Next.js SSR hydration). 
- **Trigger:** When the user clicks "Start Generating", the application will check if a key exists via `useApiKey()`. If no key is found, the generation process is suspended, and the modal renders automatically.
- **Input Field:** The modal will display a secure password-type input field to mask the API key, followed by a "Save & Continue" button. Submitting the form saves the key to `localStorage`, closes the modal, and seamlessly triggers the original generation request.

## 2. Backend Integration & Error Handling
- **API Request:** The frontend will include the stored API key in the HTTP headers (e.g., `Authorization: Bearer <key>`) when making a POST request to `/api/generate`.
- **Backend Usage:** Inside `src/app/api/generate/route.ts`, the server will extract the user-provided key from the headers and prioritize it over any local `.env` variables or server secrets, passing it directly to the Z.ai SDK.
- **Validation:** If the backend receives a request without an API key, it will return a `401 Unauthorized` status response.
- **Provider Errors:** If the Z.ai API rejects the key (due to invalid format, out of credits, etc.), the backend will catch the specific error and return an appropriate error message to the client.
- **Resiliency:** The frontend will use the existing `useToast` hook to display the error (e.g., "Invalid API Key"). If a key-related error occurs, the frontend will clear the invalid key from `localStorage` and automatically re-open the modal so the user can easily replace it.

## 3. Testing & Edge Cases
- **Next.js Hydration:** The `useApiKey` hook will be designed to avoid hydration mismatches between the server and client rendering by only accessing `localStorage` after mounting.
- **Manual Verification:**
  1. Clear browser data -> click "Generate" -> verify modal opens.
  2. Submitting an invalid key -> verify backend rejection, error toast, and modal reappearance.
  3. Submitting a valid key -> verify successful Anki card generation.
- **Multi-tab Sync:** The application can optionally listen to the `storage` event on the `window` object to automatically sync the API key state across multiple open tabs of the dashboard.
- **Security:** While `localStorage` is accessible via XSS, this is a standard and acceptable practice for personal, local-first development tools, especially with the absence of third-party tracking scripts.
