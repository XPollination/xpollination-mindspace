/**
 * Mindspace IDE — Theia browser frontend entry point
 * This file is required by Theia CLI build process.
 */
import { FrontendApplication } from '@theia/core/lib/browser';
import { frontendApplicationModule } from '@theia/core/lib/browser/frontend-application-module';
import { messagingFrontendModule } from '@theia/core/lib/browser/messaging/messaging-frontend-module';
import { ContainerModule } from '@theia/core/shared/inversify';

export default function load(raw: ContainerModule[]) {
  return [
    frontendApplicationModule,
    messagingFrontendModule,
    ...raw,
  ];
}
