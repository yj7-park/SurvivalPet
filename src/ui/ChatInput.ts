const MAX_LEN = 60;

export class ChatInput {
  private container: HTMLDivElement;
  private input: HTMLInputElement;
  private onSendCb?: (text: string) => void;
  private onCloseCb?: () => void;

  constructor() {
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed',
      left: '8px',
      bottom: '70px',
      width: '280px',
      height: '28px',
      display: 'none',
      alignItems: 'center',
      background: 'rgba(0,0,0,0.85)',
      border: '1px solid #555',
      zIndex: '9999',
      boxSizing: 'border-box',
      padding: '0 6px',
    });

    this.input = document.createElement('input');
    Object.assign(this.input.style, {
      flex: '1',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: '#ffffff',
      fontSize: '12px',
      fontFamily: 'monospace',
      width: '100%',
      caretColor: '#ffffff',
    });
    this.input.maxLength = MAX_LEN;
    this.input.placeholder = '메시지 입력...';

    this.container.appendChild(this.input);
    document.body.appendChild(this.container);

    this.input.addEventListener('keydown', (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const text = this.input.value.trim();
        this.close();
        if (text.length > 0) this.onSendCb?.(text);
      } else if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  open(): void {
    this.container.style.display = 'flex';
    this.input.value = '';
    // Small delay to avoid the Enter key that opened it being captured
    setTimeout(() => this.input.focus(), 50);
  }

  close(): void {
    this.container.style.display = 'none';
    this.input.blur();
    this.onCloseCb?.();
  }

  isOpen(): boolean { return this.container.style.display !== 'none'; }

  onSend(cb: (text: string) => void): void { this.onSendCb = cb; }
  onClose(cb: () => void): void { this.onCloseCb = cb; }

  destroy(): void {
    this.container.remove();
  }
}
