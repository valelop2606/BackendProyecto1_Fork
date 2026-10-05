import { Injectable } from '@nestjs/common';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { EnrollmentStatus } from '../enrollments/schemas/enrollment.schema';
import { GroupGradesService } from './group-grades.service';
import { ProgressService } from './progress.service';
import { ScheduleService } from './schedule.service';

// Fachada del agregado academico: delega en servicios acotados por responsabilidad
// (nomina y notas / horarios / progreso). El controlador no cambia.
@Injectable()
export class AcademicService {
  constructor(
    private readonly groupGrades: GroupGradesService,
    private readonly schedules: ScheduleService,
    private readonly progressService: ProgressService,
  ) {}

  /* ---------------- nomina y planilla de notas de un grupo ---------------- */

  roster(groupId: string, status: EnrollmentStatus | undefined, user: AuthUser) {
    return this.groupGrades.roster(groupId, status, user);
  }

  gradeSheet(groupId: string, user: AuthUser) {
    return this.groupGrades.gradeSheet(groupId, user);
  }

  finalizeGroup(groupId: string, user: AuthUser) {
    return this.groupGrades.finalizeGroup(groupId, user);
  }

  /* ---------------- horarios ---------------- */

  studentSchedule(studentId: string | null, userId: string | null, periodId?: string) {
    return this.schedules.studentSchedule(studentId, userId, periodId);
  }

  teacherSchedule(teacherId: string | null, userId: string | null, periodId?: string) {
    return this.schedules.teacherSchedule(teacherId, userId, periodId);
  }

  /* ---------------- historial academico ---------------- */

  history(studentId: string | null, userId: string | null) {
    return this.progressService.history(studentId, userId);
  }

  /* ---------------- malla curricular y progreso ---------------- */

  curriculum(programId: string) {
    return this.progressService.curriculum(programId);
  }

  progress(studentId: string | null, userId: string | null) {
    return this.progressService.progress(studentId, userId);
  }

  availableGroups(userId: string, all: boolean) {
    return this.progressService.availableGroups(userId, all);
  }
}
