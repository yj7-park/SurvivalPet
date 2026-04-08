import Phaser from 'phaser';
import { CommandQueue, QueuedCommand, CommandType } from './CommandQueue';

const COMMAND_ICONS: Record<CommandType, string> = {
  'move': '🏃',
  'chop': '🪓',
  'mine': '⛏',
  'fish': '🎣',
  'attack': '⚔️',
  'build': '🏗',
  'craft': '🔨',
  'cook': '🍳',
  'sleep': '😴',
};

const COMMAND_LABELS: Record<CommandType, string> = {
  'move': '이동',
  'chop': '벌목',
  'mine': '채굴',
  'fish': '낚시',
  'attack': '공격',
  'build': '건설',
  'craft': '제작',
  'cook': '요리',
  'sleep': '수면',
};

export class CommandQueueUI {
  private container: HTMLDivElement;
  private cardElements = new Map<string, HTMLDivElement>();
  private queue: CommandQueue;

  constructor(queue: CommandQueue) {
    this.queue = queue;
    this.container = this.createContainer();
    this.queue.onQueueChange(() => this.update());
  }

  private createContainer(): HTMLDivElement {
    const div = document.createElement('div');
    div.id = 'command-queue-ui';
    div.style.cssText = `
      position: fixed;
      bottom: 12px;
      left: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 1000;
      font-family: monospace;
    `;
    document.body.appendChild(div);
    return div;
  }

  private getCommandTargetLabel(cmd: QueuedCommand): string {
    // TODO: implement proper target names based on command type
    return '';
  }

  private createCardElement(cmd: QueuedCommand, index: number): HTMLDivElement {
    const card = document.createElement('div');
    const cmdLabel = COMMAND_LABELS[cmd.command.type];
    const cmdIcon = COMMAND_ICONS[cmd.command.type];
    const targetLabel = this.getCommandTargetLabel(cmd);
    const isExecuting = cmd.status === 'executing';
    const isFailed = cmd.status === 'failed';

    let borderColor = '#999999';
    let bgColor = 'rgba(80, 80, 80, 0.85)';
    let errorIcon = '';

    if (isExecuting) {
      borderColor = '#ffffff';
      bgColor = 'rgba(50, 100, 150, 0.85)';
    } else if (isFailed) {
      borderColor = '#ff4444';
      bgColor = 'rgba(150, 50, 50, 0.85)';
      errorIcon = cmd.command.type === 'attack' ? '✗' : '⚠';
    }

    card.style.cssText = `
      border: 2px solid ${borderColor};
      background: ${bgColor};
      color: #ffffff;
      padding: 6px 8px;
      border-radius: 4px;
      font-size: 11px;
      min-width: 160px;
      transition: all 0.2s ease;
    `;

    const headerHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: bold;">
          ${errorIcon || ''}${cmdIcon} ${cmdLabel} ${targetLabel}
        </span>
        <span style="font-size: 9px; color: #aaaaaa;">${index + 1}</span>
      </div>
    `;

    card.innerHTML = headerHtml;

    // Add progress bar only if executing
    if (isExecuting) {
      const progressDiv = document.createElement('div');
      progressDiv.style.cssText = `
        margin-top: 4px;
        height: 4px;
        background: #333333;
        border-radius: 2px;
        overflow: hidden;
      `;
      const fillDiv = document.createElement('div');
      fillDiv.style.cssText = `
        height: 100%;
        background: #ffaa00;
        width: 45%;
        transition: width 0.1s linear;
      `;
      fillDiv.id = `progress-${cmd.id}`;
      progressDiv.appendChild(fillDiv);
      card.appendChild(progressDiv);
    }

    // Add context menu (right-click to remove)
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const queueIndex = Array.from(this.cardElements.values()).indexOf(card);
      if (queueIndex >= 0) {
        this.queue.removeAt(queueIndex);
      }
    });

    return card;
  }

  update(): void {
    const queuedCmds = this.queue.getQueue();

    // Remove old cards no longer in queue
    for (const [cmdId, cardEl] of this.cardElements.entries()) {
      if (!queuedCmds.some(q => q.id === cmdId)) {
        cardEl.remove();
        this.cardElements.delete(cmdId);
      }
    }

    // Update or create cards
    queuedCmds.forEach((qCmd, index) => {
      let cardEl = this.cardElements.get(qCmd.id);
      if (!cardEl) {
        cardEl = this.createCardElement(qCmd, index);
        this.container.appendChild(cardEl);
        this.cardElements.set(qCmd.id, cardEl);

        // Fade in animation
        cardEl.style.opacity = '0';
        setTimeout(() => {
          cardEl!.style.opacity = '1';
          cardEl!.style.transition = 'opacity 0.3s ease';
        }, 0);
      } else {
        // Update index number
        const indexSpan = cardEl.querySelector('span:last-child') as HTMLSpanElement | null;
        if (indexSpan) indexSpan.textContent = String(index + 1);
      }
    });

    // Show/hide container based on queue state
    this.container.style.display = queuedCmds.length > 0 ? 'flex' : 'none';
  }

  setProgressPercent(cmdId: string, percent: number): void {
    const progressBar = document.querySelector(`#progress-${cmdId}`) as HTMLDivElement | null;
    if (progressBar) {
      progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
  }

  destroy(): void {
    this.container.remove();
    this.cardElements.clear();
  }
}
