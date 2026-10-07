import { PartialType } from '@nestjs/mapped-types';
import { CreateCensoDto } from './create-censo.dto';

export class UpdateCensoDto extends PartialType(CreateCensoDto) {}
