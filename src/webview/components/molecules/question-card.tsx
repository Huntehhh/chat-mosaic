'use client';

import * as React from 'react';
import { useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Icon } from '../ui/icon';

const questionCardVariants = cva(
  'relative w-full overflow-hidden rounded-lg border p-[14px] animate-slide-up',
  {
    variants: {
      state: {
        pending: 'border-[rgba(100,180,255,0.2)] bg-[rgba(100,180,255,0.06)]',
        answered: 'border-[rgba(100,180,255,0.2)] bg-[rgba(100,180,255,0.08)]',
      },
    },
    defaultVariants: {
      state: 'pending',
    },
  }
);

export interface QuestionOption {
  label: string;
  description?: string;
}

export interface QuestionCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof questionCardVariants> {
  question: string;
  options?: QuestionOption[];
  multiSelect?: boolean;
  state?: 'pending' | 'answered';
  answeredValue?: string;
  onSubmit?: (answer: string, selectedOptions?: string[]) => void;
}

const QuestionCard = React.forwardRef<HTMLDivElement, QuestionCardProps>(
  (
    {
      className,
      question,
      options,
      multiSelect = false,
      state = 'pending',
      answeredValue,
      onSubmit,
      ...props
    },
    ref
  ) => {
    const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
    const [textInput, setTextInput] = useState('');

    const handleOptionClick = (label: string) => {
      if (multiSelect) {
        const newSelected = new Set(selectedOptions);
        if (newSelected.has(label)) {
          newSelected.delete(label);
        } else {
          newSelected.add(label);
        }
        setSelectedOptions(newSelected);
      } else {
        // Single select - submit immediately
        if (onSubmit) {
          onSubmit(label, [label]);
        }
      }
    };

    const handleSubmit = () => {
      if (onSubmit) {
        if (options && options.length > 0) {
          // Option-based answer
          const selected = Array.from(selectedOptions);
          onSubmit(selected.join(', '), selected);
        } else {
          // Free-form text answer
          onSubmit(textInput);
        }
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    };

    return (
      <div
        ref={ref}
        className={cn(questionCardVariants({ state }), className)}
        {...props}
      >
        {/* Header Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <Icon name="help" className="text-[#64B4FF]" />
            <h2 className="text-sm font-medium text-white leading-tight">
              Question from Claude
            </h2>
          </div>
        </div>

        {/* Question Text */}
        <div className="mb-4">
          <p className="text-[14px] text-[#e1e1e3] leading-relaxed">
            {question}
          </p>
        </div>

        {state === 'pending' ? (
          <>
            {/* Options or Text Input */}
            {options && options.length > 0 ? (
              <div className="flex flex-col gap-2 mb-4">
                {options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleOptionClick(option.label)}
                    className={cn(
                      'w-full text-left p-3 rounded-md border transition-all',
                      'hover:border-[#64B4FF]/50 hover:bg-[#64B4FF]/10',
                      selectedOptions.has(option.label)
                        ? 'border-[#64B4FF] bg-[#64B4FF]/15'
                        : 'border-[#333] bg-[#0f0f0f]'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {multiSelect && (
                        <div
                          className={cn(
                            'w-4 h-4 mt-0.5 rounded border flex items-center justify-center flex-shrink-0',
                            selectedOptions.has(option.label)
                              ? 'border-[#64B4FF] bg-[#64B4FF]'
                              : 'border-[#555]'
                          )}
                        >
                          {selectedOptions.has(option.label) && (
                            <Icon name="check" size="xs" className="text-white" />
                          )}
                        </div>
                      )}
                      <div className="flex-1">
                        <span className="text-[13px] font-medium text-white">
                          {option.label}
                        </span>
                        {option.description && (
                          <p className="text-[12px] text-[#8b8b94] mt-1">
                            {option.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}

                {/* "Other" option for custom input */}
                <div className="mt-2">
                  <p className="text-[12px] text-[#8b8b94] mb-2">Or provide a custom answer:</p>
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your answer..."
                    className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#333] rounded-md text-[13px] text-white placeholder-[#555] focus:outline-none focus:border-[#64B4FF]"
                  />
                </div>
              </div>
            ) : (
              /* Free-form text input when no options */
              <div className="mb-4">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your answer..."
                  rows={3}
                  className="w-full px-3 py-2 bg-[#0f0f0f] border border-[#333] rounded-md text-[13px] text-white placeholder-[#555] focus:outline-none focus:border-[#64B4FF] resize-none"
                />
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button
                variant="default"
                size="sm"
                onClick={handleSubmit}
                disabled={
                  options && options.length > 0
                    ? selectedOptions.size === 0 && !textInput.trim()
                    : !textInput.trim()
                }
                className="px-4 h-8 bg-[#64B4FF] hover:bg-[#5AA3EE] text-black font-medium shadow-md shadow-[#64B4FF]/20"
              >
                Submit Answer
              </Button>
            </div>
          </>
        ) : (
          /* Answered state */
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#64B4FF]">
              <Icon name="check" size="sm" className="font-bold" />
              <span className="text-sm font-medium">Answered</span>
            </div>
            {answeredValue && (
              <span className="text-[13px] text-[#8b8b94] max-w-[60%] truncate">
                {answeredValue}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
);
QuestionCard.displayName = 'QuestionCard';

export { QuestionCard, questionCardVariants };
