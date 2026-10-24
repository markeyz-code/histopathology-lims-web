import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';

export const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

export function isValidObjectId(value: string): boolean {
  return OBJECT_ID_PATTERN.test(value) && Types.ObjectId.isValid(value);
}

@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isValidObjectId(value)) {
      throw new BadRequestException('Invalid identifier.');
    }
    return value;
  }
}
