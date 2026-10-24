import { SetMetadata } from '@nestjs/common';
import type { Discipline as DisciplineId } from '@lims/shared';

export const DISCIPLINE_KEY = 'lims:disciplines';
export const Discipline = (...disciplines: DisciplineId[]): ClassDecorator & MethodDecorator =>
  SetMetadata(DISCIPLINE_KEY, disciplines);
