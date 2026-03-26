/**
 * Terminal Injector — write task context to agent terminals when events arrive
 * When task_available arrives for a role, find terminal with that role label,
 * write task instructions to stdin so Claude sees it.
 */
import { inject, injectable } from '@theia/core/shared/inversify';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';

@injectable()
export class TerminalInjector {
  @inject(TerminalService)
  protected readonly terminalService!: TerminalService;

  /**
   * Find terminal by role label and inject text
   */
  async injectToRole(role: string, text: string): Promise<boolean> {
    const terminals = this.terminalService.all;
    const target = terminals.find(t => {
      const title = (t as any).title?.label || '';
      return title.toLowerCase().includes(role.toLowerCase());
    });

    if (!target) return false;

    // Write to terminal stdin
    try {
      (target as any).sendText?.(text + '\n');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Handle task_assigned event — inject task context into agent terminal
   */
  async onTaskAssigned(data: any): Promise<void> {
    const role = data.role;
    if (!role) return;

    const taskInfo = [
      `\n--- TASK ASSIGNED: ${data.task_slug} ---`,
      `Title: ${data.title || data.task_slug}`,
      `Role: ${role}`,
      `Transitions: ${(data.available_transitions || []).map((t: any) => t.to_status).join(', ')}`,
      '---\n',
    ].join('\n');

    await this.injectToRole(role, taskInfo);
  }
}
