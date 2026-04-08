import { TILE_SIZE } from '../world/MapGenerator';

export type CommandType =
  | 'move'
  | 'chop'
  | 'mine'
  | 'fish'
  | 'attack'
  | 'build'
  | 'craft'
  | 'cook'
  | 'sleep';

export interface Command {
  id: string;
  type: CommandType;
  targetX?: number;
  targetY?: number;
  targetId?: string;     // for animal attacks
  data?: Record<string, unknown>;
}

export interface QueuedCommand {
  id: string;
  command: Command;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  errorReason?: string;  // 'target_died', 'no_resources', etc
}

export class CommandQueue {
  private queue: QueuedCommand[] = [];
  private currentCommand: QueuedCommand | null = null;
  private nextId = 0;
  private readonly maxLength = 20;
  private commandListeners: ((queue: QueuedCommand[]) => void)[] = [];

  constructor() {}

  add(command: Command): boolean {
    if (this.queue.length >= this.maxLength) {
      return false;
    }

    const queuedCmd: QueuedCommand = {
      id: `cmd_${this.nextId++}`,
      command,
      status: 'pending',
    };
    this.queue.push(queuedCmd);
    this.notifyListeners();
    return true;
  }

  hasCommands(): boolean {
    return this.queue.length > 0;
  }

  getNextCommand(): Command | null {
    if (this.queue.length === 0) return null;
    const queuedCmd = this.queue[0];
    queuedCmd.status = 'executing';
    this.currentCommand = queuedCmd;
    this.notifyListeners();
    return queuedCmd.command;
  }

  completeCommand(): void {
    if (this.currentCommand) {
      this.currentCommand.status = 'completed';
      this.queue.shift();
      this.currentCommand = null;
    }
    this.notifyListeners();
  }

  failCommand(reason: string): void {
    if (this.currentCommand) {
      this.currentCommand.status = 'failed';
      this.currentCommand.errorReason = reason;
      this.queue.shift();
      this.currentCommand = null;
    }
    this.notifyListeners();
  }

  clearAll(): void {
    this.queue = [];
    this.currentCommand = null;
    this.nextId = 0;
    this.notifyListeners();
  }

  getQueue(): QueuedCommand[] {
    return [...this.queue];
  }

  getCurrentCommand(): QueuedCommand | null {
    return this.currentCommand;
  }

  getLength(): number {
    return this.queue.length;
  }

  removeAt(index: number): void {
    if (index < 0 || index >= this.queue.length) return;
    this.queue.splice(index, 1);
    this.notifyListeners();
  }

  reorderQueue(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.queue.length) return;
    if (toIndex < 0 || toIndex >= this.queue.length) return;
    const cmd = this.queue.splice(fromIndex, 1)[0];
    this.queue.splice(toIndex, 0, cmd);
    this.notifyListeners();
  }

  onQueueChange(listener: (queue: QueuedCommand[]) => void): void {
    this.commandListeners.push(listener);
  }

  private notifyListeners(): void {
    const currentQueue = [...this.queue];
    this.commandListeners.forEach(listener => listener(currentQueue));
  }
}
