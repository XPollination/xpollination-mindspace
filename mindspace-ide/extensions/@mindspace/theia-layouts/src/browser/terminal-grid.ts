/**
 * Terminal Grid — programmatic 2x2 terminal grid for agent panels
 * Opens 4 terminals labeled Liaison/PDSA/DEV/QA, each running a2a-agent.
 */
import { inject, injectable } from '@theia/core/shared/inversify';
import { Command, CommandContribution, CommandRegistry } from '@theia/core';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';

export const OPEN_AGENT_GRID: Command = {
  id: 'mindspace.openAgentGrid',
  label: 'Mindspace: Open Agent Grid',
  category: 'Mindspace',
};

const AGENT_ROLES = ['liaison', 'pdsa', 'dev', 'qa'];

@injectable()
export class TerminalGridContribution implements CommandContribution {
  @inject(TerminalService)
  protected readonly terminalService!: TerminalService;

  registerCommands(registry: CommandRegistry): void {
    registry.registerCommand(OPEN_AGENT_GRID, {
      execute: async () => {
        for (const role of AGENT_ROLES) {
          const terminal = await this.terminalService.newTerminal({
            title: `${role.toUpperCase()} Agent`,
            shellPath: '/bin/bash',
            shellArgs: ['-c', `node /app/src/a2a/monitor-v2.js ${role}`],
            cwd: '/workspace',
          });
          await terminal.start();
          this.terminalService.open(terminal);
        }
      },
    });
  }
}
