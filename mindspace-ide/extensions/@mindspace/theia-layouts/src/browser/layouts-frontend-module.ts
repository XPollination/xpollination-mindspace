/**
 * Layouts Frontend Module — Theia extension for panel layout presets
 * Phase 2: will provide layout preset commands, persistence, drag handles
 */
import { ContainerModule } from '@theia/core/shared/inversify';

export default new ContainerModule(bind => {
  // Phase 2: bind layout manager service, preset commands, toolbar contributions
  console.log('@mindspace/theia-layouts extension loaded');
});
