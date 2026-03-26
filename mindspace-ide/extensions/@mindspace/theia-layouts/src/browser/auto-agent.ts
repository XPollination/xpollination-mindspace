/**
 * Auto Agent — auto-start agents when layout template opens
 * Opening Agent Grid auto-spawns 4 Claude processes. Closing stops them.
 */
import { inject, injectable } from '@theia/core/shared/inversify';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { LayoutPresetService, LayoutPreset } from './layout-presets';

@injectable()
export class AutoAgentService {
  @inject(TerminalService)
  protected readonly terminalService!: TerminalService;

  @inject(LayoutPresetService)
  protected readonly presetService!: LayoutPresetService;

  private activeTerminals = new Map<string, any[]>();

  async openPreset(presetId: string, workspace = '/workspace'): Promise<void> {
    const preset = this.presetService.getPreset(presetId);
    if (!preset) return;

    // Close existing terminals for this preset
    await this.closePreset(presetId);

    const terminals: any[] = [];
    for (const role of preset.roles) {
      const terminal = await this.terminalService.newTerminal({
        title: `${role.toUpperCase()} Agent`,
        shellPath: '/bin/bash',
        shellArgs: ['-c', `node /app/src/a2a/monitor-v2.js ${role}`],
        cwd: workspace,
      });
      await terminal.start();
      this.terminalService.open(terminal);
      terminals.push(terminal);
    }

    this.activeTerminals.set(presetId, terminals);
  }

  async closePreset(presetId: string): Promise<void> {
    const terminals = this.activeTerminals.get(presetId);
    if (!terminals) return;

    for (const terminal of terminals) {
      try { terminal.dispose(); } catch { /* ignore */ }
    }
    this.activeTerminals.delete(presetId);
  }
}
