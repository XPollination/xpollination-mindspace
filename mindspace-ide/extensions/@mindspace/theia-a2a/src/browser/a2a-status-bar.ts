/**
 * A2A Status Bar — shows agent connection status and active task count
 */
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { StatusBar, StatusBarAlignment } from '@theia/core/lib/browser';

const A2A_STATUS_ID = 'mindspace.a2a.status';

@injectable()
export class A2AStatusBarContribution {
  @inject(StatusBar)
  protected readonly statusBar!: StatusBar;

  private connected = false;
  private activeTasks = 0;

  @postConstruct()
  init(): void {
    this.updateStatusBar();
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
    this.updateStatusBar();
  }

  setActiveTasks(count: number): void {
    this.activeTasks = count;
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    const icon = this.connected ? '$(debug-disconnect)' : '$(circle-slash)';
    const text = this.connected
      ? `A2A: Connected (${this.activeTasks} tasks)`
      : 'A2A: Disconnected';

    this.statusBar.setElement(A2A_STATUS_ID, {
      text,
      alignment: StatusBarAlignment.RIGHT,
      priority: 100,
      tooltip: this.connected ? 'Connected to Mindspace A2A' : 'Not connected to A2A server',
    });
  }
}
