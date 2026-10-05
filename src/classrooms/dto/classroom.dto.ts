import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RoomType } from '../schemas/classroom.schema';

export class CreateClassroomDto {
  @ApiProperty({ example: 'B-203' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'B' })
  @IsString()
  @IsNotEmpty()
  building!: string;

  @ApiProperty({ minimum: 1, maximum: 30, example: 2 })
  @IsInt()
  @Min(1)
  @Max(30)
  floor!: number;

  @ApiProperty({ minimum: 5, maximum: 500, example: 40 })
  @IsInt()
  @Min(5)
  @Max(500)
  capacity!: number;

  @ApiPropertyOptional({ enum: RoomType, default: RoomType.Classroom })
  @IsOptional()
  @IsEnum(RoomType)
  type?: RoomType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  hasProjector?: boolean;
}

export class UpdateClassroomDto extends PartialType(CreateClassroomDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ClassroomsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'B', description: 'Filtrar por edificio' })
  @IsOptional()
  @IsString()
  building?: string;

  @ApiPropertyOptional({ enum: RoomType })
  @IsOptional()
  @IsEnum(RoomType)
  type?: RoomType;

  @ApiPropertyOptional({ description: 'Capacidad minima' })
  @IsOptional()
  @Transform(({ value }) => {
    // Solo lo convertible pasa como numero; el resto lo rechaza IsInt con mensaje
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : value;
  })
  @IsInt()
  @Min(1)
  minCapacity?: number;
}
