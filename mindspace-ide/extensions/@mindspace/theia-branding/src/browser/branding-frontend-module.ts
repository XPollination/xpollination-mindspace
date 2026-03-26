/**
 * Branding — white-label Theia as Mindspace IDE
 */
import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { injectable, postConstruct } from '@theia/core/shared/inversify';

@injectable()
export class MindspaceBranding implements FrontendApplicationContribution {
  @postConstruct()
  init(): void {
    // Update document title
    document.title = 'Mindspace IDE';
  }

  onStart(): void {
    // Apply branding CSS overrides
    const style = document.createElement('style');
    style.textContent = `
      /* Mindspace IDE branding */
      .theia-about-dialog .about-details .about-name { visibility: hidden; }
      .theia-about-dialog .about-details .about-name::after { content: 'Mindspace IDE'; visibility: visible; position: absolute; }
    `;
    document.head.appendChild(style);
  }
}

export default new ContainerModule(bind => {
  bind(FrontendApplicationContribution).to(MindspaceBranding).inSingletonScope();
  console.log('@mindspace/theia-branding extension loaded');
});
