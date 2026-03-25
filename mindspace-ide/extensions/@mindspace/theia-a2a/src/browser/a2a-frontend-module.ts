/**
 * A2A Frontend Module — Theia extension for agent panels, SSE events, liaison chat
 */
import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution } from '@theia/core';
import { AgentCommandContribution } from './agent-command';
import { A2AStatusBarContribution } from './a2a-status-bar';
import { TerminalInjector } from './terminal-injector';
import { LiaisonChatWidget } from './liaison-chat-widget';

export default new ContainerModule(bind => {
  bind(CommandContribution).to(AgentCommandContribution).inSingletonScope();
  bind(A2AStatusBarContribution).toSelf().inSingletonScope();
  bind(TerminalInjector).toSelf().inSingletonScope();
  bind(LiaisonChatWidget).toSelf().inSingletonScope();
  console.log('@mindspace/theia-a2a extension loaded');
});
