import { IsObject } from 'class-validator';

export class UpdateUserPermissionsDto {
  @IsObject()
  permissions: Record<string, boolean>;
}
