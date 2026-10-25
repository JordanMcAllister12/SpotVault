import { useRef, useEffect, useCallback, KeyboardEvent } from 'react';

interface BaseProps {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

interface TextLikeProps extends BaseProps {
  /** Plain-text value. Card notation stored as unicode suit symbols (e.g. "A♠K♥"). */
  value: string;
  onChange: (text: string) => void;
  multiline?: boolean;
  rows?: number;
  onFieldFocus?: (el: HTMLDivElement) => void;
  onFieldSelect?: () => void;
}

/**
 * ContentEditable text field that stores plain text (textContent).
 * Does NOT auto-convert card notation to visual cards — only explicit
 * palette-inserted card spans appear as graphics while editing.
 * On reload the field shows plain text notation (e.g. "A♠"); display
 * views use renderInlineCardText to render visual cards from the notation.
 */
export function EditableTextField({
  value,
  onChange,
  className,
  placeholder,
  multiline = false,
  rows,
  autoFocus,
  onFieldFocus,
  onFieldSelect,
}: TextLikeProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Sync external value → DOM only when the field is NOT focused.
  // While focused, the user's edits (including palette-inserted card
  // spans) must remain intact.  We compare textContent (not innerHTML)
  // so card spans that produce the same text are preserved on blur.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.textContent !== value) {
      el.textContent = value;
    }
  }, [value]);

  const handleInput = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    onChange(el.textContent || '');
  }, [onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      (e.currentTarget as HTMLElement).blur();
    }
  }, [multiline]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  const handleFocus = useCallback(() => {
    const el = ref.current;
    if (el) onFieldFocus?.(el);
  }, [onFieldFocus]);

  const handleSelect = useCallback(() => {
    onFieldSelect?.();
  }, [onFieldSelect]);

  const style: React.CSSProperties = {};
  if (!multiline) {
    style.height = 'auto';
    style.whiteSpace = 'nowrap';
    style.overflow = 'hidden';
    style.textOverflow = 'ellipsis';
  } else if (rows) {
    style.minHeight = `${rows * 1.6}rem`;
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={handleFocus}
      onSelect={handleSelect}
      onClick={handleFocus}
      onKeyUp={handleSelect}
      className={className}
      style={style}
      data-placeholder={placeholder}
      aria-label={placeholder}
    />
  );
}
