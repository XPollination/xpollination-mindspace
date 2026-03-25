/**
 * Layouts Frontend Module — terminal grid, layout presets, auto-agent spawning
 */
import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution } from '@theia/core';
import { TerminalGridContribution } from './terminal-grid';
import { LayoutPresetService } from './layout-presets';
import { AutoAgentService } from './auto-agent';

export default new ContainerModule(bind => {
  bind(CommandContribution).to(TerminalGridContribution).inSingletonScope();
  bind(LayoutPresetService).toSelf().inSingletonScope();
  bind(AutoAgentService).toSelf().inSingletonScope();
  console.log('@mindspace/theia-layouts extension loaded');
});
