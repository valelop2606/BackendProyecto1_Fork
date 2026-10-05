import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AcademicService } from './academic.service';
import { AvailableQueryDto, RosterQueryDto, ScheduleQueryDto } from './dto/academic.dto';

// Consultas y operaciones academicas que cruzan varias colecciones (grupos, matriculas, notas, horarios)
@ApiTags('academics')
@ApiBearerAuth()
@Controller()
export class AcademicController {
  constructor(private readonly academicService: AcademicService) {}

  /* ----- grupos (admin o docente a cargo) ----- */

  @ApiOperation({ summary: 'Lista de estudiantes matriculados en un grupo' })
  @Roles(Role.Admin, Role.Docente)
  @Get('groups/:id/roster')
  roster(@Param('id', ParseObjectIdPipe) id: string, @Query() query: RosterQueryDto, @CurrentUser() user: AuthUser) {
    return this.academicService.roster(id, query.status, user);
  }

  @ApiOperation({ summary: 'Planilla de notas del grupo: evaluaciones x estudiantes, con promedio parcial' })
  @Roles(Role.Admin, Role.Docente)
  @Get('groups/:id/grade-sheet')
  gradeSheet(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.academicService.gradeSheet(id, user);
  }

  @ApiOperation({ summary: 'Finaliza en bloque las matriculas activas del grupo (calcula nota final y aprueba/reprueba)' })
  @Roles(Role.Admin, Role.Docente)
  @Post('groups/:id/finalize')
  @HttpCode(200)
  finalizeGroup(@Param('id', ParseObjectIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.academicService.finalizeGroup(id, user);
  }

  /* ----- horario e historial del estudiante ('me' va antes de ':id') ----- */

  @ApiOperation({ summary: 'Mi horario semanal en un periodo (por defecto el abierto)' })
  @Roles(Role.Estudiante)
  @Get('students/me/schedule')
  mySchedule(@CurrentUser() user: AuthUser, @Query() query: ScheduleQueryDto) {
    return this.academicService.studentSchedule(null, user.id, query.period);
  }

  @ApiOperation({ summary: 'Grupos del periodo abierto que puedo matricular (cupo, prerrequisitos y materia pendiente)' })
  @Roles(Role.Estudiante)
  @Get('students/me/available-groups')
  availableForMe(@CurrentUser() user: AuthUser, @Query() query: AvailableQueryDto) {
    return this.academicService.availableGroups(user.id, query.all ?? false);
  }

  @ApiOperation({ summary: 'Mi malla curricular: que aprobe, que cursa y que puedo matricular' })
  @Roles(Role.Estudiante)
  @Get('students/me/progress')
  myProgress(@CurrentUser() user: AuthUser) {
    return this.academicService.progress(null, user.id);
  }

  @ApiOperation({ summary: 'Malla curricular y avance de un estudiante' })
  @Roles(Role.Admin, Role.Docente)
  @Get('students/:id/progress')
  studentProgress(@Param('id', ParseObjectIdPipe) id: string) {
    return this.academicService.progress(id, null);
  }

  @ApiOperation({ summary: 'Malla curricular de un programa: materias por semestre con prerrequisitos' })
  @Roles(Role.Admin, Role.Docente, Role.Estudiante)
  @Get('programs/:id/curriculum')
  curriculum(@Param('id', ParseObjectIdPipe) id: string) {
    return this.academicService.curriculum(id);
  }

  @ApiOperation({ summary: 'Mi historial academico: materias por periodo, promedio y avance de la carrera' })
  @Roles(Role.Estudiante)
  @Get('students/me/history')
  myHistory(@CurrentUser() user: AuthUser) {
    return this.academicService.history(null, user.id);
  }

  @ApiOperation({ summary: 'Horario semanal de un estudiante' })
  @Roles(Role.Admin, Role.Docente)
  @Get('students/:id/schedule')
  studentSchedule(@Param('id', ParseObjectIdPipe) id: string, @Query() query: ScheduleQueryDto) {
    return this.academicService.studentSchedule(id, null, query.period);
  }

  @ApiOperation({ summary: 'Historial academico de un estudiante' })
  @Roles(Role.Admin, Role.Docente)
  @Get('students/:id/history')
  studentHistory(@Param('id', ParseObjectIdPipe) id: string) {
    return this.academicService.history(id, null);
  }

  /* ----- horario del docente ----- */

  @ApiOperation({ summary: 'Mi horario de clases en un periodo (por defecto el abierto)' })
  @Roles(Role.Docente)
  @Get('teachers/me/schedule')
  myTeacherSchedule(@CurrentUser() user: AuthUser, @Query() query: ScheduleQueryDto) {
    return this.academicService.teacherSchedule(null, user.id, query.period);
  }

  @ApiOperation({ summary: 'Horario de clases de un docente' })
  @Roles(Role.Admin)
  @Get('teachers/:id/schedule')
  teacherSchedule(@Param('id', ParseObjectIdPipe) id: string, @Query() query: ScheduleQueryDto) {
    return this.academicService.teacherSchedule(id, null, query.period);
  }
}
