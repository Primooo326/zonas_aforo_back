import { PartialType } from '@nestjs/mapped-types';
import { CreateInmuebleDto } from './create-inmueble.dto';

export class UpdateInmuebleDto extends PartialType(CreateInmuebleDto) {}
