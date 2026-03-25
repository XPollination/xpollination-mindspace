/**
 * Layout Presets — predefined panel arrangements
 * Agent Grid (4 terminals), Focus (1 fullscreen), Code+Agent (editor+terminal), Review
 */
import { injectable } from '@theia/core/shared/inversify';

export interface LayoutPreset {
  id: string;
  label: string;
  description: string;
  roles: string[];
  terminals: number;
}

export const PRESETS: LayoutPreset[] = [
  { id: 'agent-grid', label: 'Agent Grid', description: '4 agent terminals in 2x2 grid', roles: ['liaison', 'pdsa', 'dev', 'qa'], terminals: 4 },
  { id: 'focus', label: 'Focus', description: 'Single agent fullscreen', roles: ['dev'], terminals: 1 },
  { id: 'code-agent', label: 'Code + Agent', description: 'Editor left, agent terminal right', roles: ['dev'], terminals: 1 },
  { id: 'review', label: 'Review', description: 'Liaison chat + diff viewer + test output', roles: ['liaison', 'qa'], terminals: 2 },
  { id: 'dual', label: 'Dual', description: 'Two agent terminals side by side', roles: ['pdsa', 'dev'], terminals: 2 },
];

@injectable()
export class LayoutPresetService {
  getPresets(): LayoutPreset[] {
    return PRESETS;
  }

  getPreset(id: string): LayoutPreset | undefined {
    return PRESETS.find(p => p.id === id);
  }
}
