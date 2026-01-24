import { useState, useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useVSCodeSender } from './useVSCodeMessaging';

/**
 * Hook for chat input actions (send, stop, new chat)
 * Extracts input handling logic from App.tsx
 */
export function useChatActions() {
  const { draftMessage, setDraftMessage, isProcessing, pendingImages, clearPendingImages } = useChatStore();
  const { planMode, thinkingMode } = useSettingsStore();
  const { sendMessage, stopProcess, newSession } = useVSCodeSender();

  // Local input state synced with draft
  const [inputValue, setInputValue] = useState(draftMessage);

  // Use ref to always have access to current input value (avoids stale closure issues)
  const inputValueRef = useRef(inputValue);
  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  // Sync draft message to input
  useEffect(() => {
    setInputValue(draftMessage);
  }, [draftMessage]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    setDraftMessage(value);
  }, [setDraftMessage]);

  const handleSubmit = useCallback(() => {
    // Use ref to get current value (avoids stale closure when called during processing)
    const currentValue = inputValueRef.current;
    // Only check for empty input - allow sending while processing (concurrent messages)
    if (!currentValue.trim()) return;
    // Build images array with id, path, and position for sending
    const images = pendingImages.map(img => ({ id: img.id, path: img.path, position: img.position }));
    sendMessage(currentValue, planMode, thinkingMode, images.length > 0 ? images : undefined);
    setInputValue('');
    setDraftMessage('');
    clearPendingImages();
  }, [planMode, thinkingMode, pendingImages, sendMessage, setDraftMessage, clearPendingImages]);

  const handleStop = useCallback(() => {
    stopProcess();
  }, [stopProcess]);

  const handleNewChat = useCallback(() => {
    newSession();
  }, [newSession]);

  const handleFileDrop = useCallback((files: FileList) => {
    // TODO: Handle file drop - integrate with selectImageFile sender
    console.log('Files dropped:', files);
  }, []);

  return {
    // State
    inputValue,
    isProcessing,
    planMode,
    thinkingMode,

    // Actions
    handleInputChange,
    handleSubmit,
    handleStop,
    handleNewChat,
    handleFileDrop,
  };
}
