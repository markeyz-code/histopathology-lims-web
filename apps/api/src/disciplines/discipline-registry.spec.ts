import { DisciplineRegistry } from '../core/discipline/discipline.registry';
import { histopathologyDefinition } from './histopathology/discipline';
import { haematologyDefinition } from './haematology/discipline';
import { chemistryDefinition } from './chemistry/discipline';
import { microbiologyDefinition } from './microbiology/discipline';

describe('DisciplineRegistry', () => {
  it('registers all four discipline definitions with their state machines', () => {
    const registry = new DisciplineRegistry();
    registry.register(histopathologyDefinition());
    registry.register(haematologyDefinition());
    registry.register(chemistryDefinition());
    registry.register(microbiologyDefinition());

    expect(registry.all()).toHaveLength(4);
    expect(registry.require('HISTOPATHOLOGY').stateMachines).toHaveLength(3);
    expect(registry.require('HAEMATOLOGY').stateMachines[0]?.entityType).toBe('SAMPLE');
    expect(registry.require('MICROBIOLOGY').stateMachines[0]?.entityType).toBe('CULTURE');
    expect(registry.get('CHEMICAL_PATHOLOGY')?.worklistConfigs).toHaveLength(1);
  });

  it('filters definitions by the disciplines enabled for a laboratory', () => {
    const registry = new DisciplineRegistry();
    registry.register(histopathologyDefinition());
    registry.register(haematologyDefinition());
    registry.register(chemistryDefinition());
    registry.register(microbiologyDefinition());
    expect(registry.enabled(['HAEMATOLOGY']).map((item) => item.id)).toEqual(['HAEMATOLOGY']);
    expect(registry.enabled(['HISTOPATHOLOGY', 'MICROBIOLOGY'])).toHaveLength(2);
  });

  it('fails closed when a discipline is not registered', () => {
    const registry = new DisciplineRegistry();
    expect(registry.get('HISTOPATHOLOGY')).toBeNull();
    expect(() => registry.require('HISTOPATHOLOGY')).toThrow('not registered');
  });
});
