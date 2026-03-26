/**
 * Agent Command — Mindspace: Start Agent
 * Opens Theia terminal, runs claude --cwd /workspace/<project>, labels with role.
 */
import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry } from '@theia/core';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';

export const START_AGENT_COMMAND: Command = {
  id: 'mindspace.startAgent',
  label: 'Mindspace: Start Agent',
  category: 'Mindspace',
};

@injectable()
export class AgentCommandContribution implements CommandContribution {
  @inject(TerminalService)
  protected readonly terminalService!: TerminalService;

  registerCommands(registry: CommandRegistry): void {
    registry.registerCommand(START_AGENT_COMMAND, {
      execute: async (role: string = 'dev', project: string = '/workspace') => {
        const title = `${role.toUpperCase()} Agent`;
        const terminal = await this.terminalService.newTerminal({
          title,
          shellPath: '/bin/bash',
          shellArgs: ['-c', `node /app/src/a2a/monitor-v2.js ${role}`],
          cwd: project,
        });
        await terminal.start();
        this.terminalService.open(terminal);
      },
    });
  }
}
