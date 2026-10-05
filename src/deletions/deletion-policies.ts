import { ConflictException, NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { ClassroomDocument } from '../classrooms/schemas/classroom.schema';
import { EnrollmentDocument, EnrollmentStatus } from '../enrollments/schemas/enrollment.schema';
import { EvaluationDocument } from '../evaluations/schemas/evaluation.schema';
import { Faculty, FacultyDocument } from '../faculties/schemas/faculty.schema';
import { GradeDocument } from '../grades/schemas/grade.schema';
import { GroupsService } from '../groups/groups.service';
import { GroupDocument } from '../groups/schemas/group.schema';
import { NotificationDocument } from '../notifications/schemas/notification.schema';
import { PeriodDocument, PeriodStatus } from '../periods/schemas/period.schema';
import { ProgramDocument } from '../programs/schemas/program.schema';
import { StudentDocument } from '../students/schemas/student.schema';
import { SubjectDocument } from '../subjects/schemas/subject.schema';
import { TeacherDocument } from '../teachers/schemas/teacher.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { Deleted } from './deletions.service';

// Cada agregado declara su propia regla de borrado seguro. Agregar una dependencia
// es agregar una politica, sin tocar el ejecutor (abierto a extension, cerrado a modificacion).
export interface DeletionContext {
  user?: AuthUser;
  userId?: string;
  actor?: AuthUser;
}

export interface DeletionPolicy {
  readonly kind: string;
  execute(id: string, ctx?: DeletionContext): Promise<Deleted>;
}

export interface DeletionDeps {
  groupModel: Model<GroupDocument>;
  enrollmentModel: Model<EnrollmentDocument>;
  evaluationModel: Model<EvaluationDocument>;
  gradeModel: Model<GradeDocument>;
  notificationModel: Model<NotificationDocument>;
  classroomModel: Model<ClassroomDocument>;
  facultyModel: Model<FacultyDocument>;
  programModel: Model<ProgramDocument>;
  subjectModel: Model<SubjectDocument>;
  periodModel: Model<PeriodDocument>;
  userModel: Model<UserDocument>;
  studentModel: Model<StudentDocument>;
  teacherModel: Model<TeacherDocument>;
  groupsService: GroupsService;
}

async function mustExist<D>(model: { findById(id: string): { exec(): Promise<D | null> } }, id: string, label: string): Promise<D> {
  const doc = await model.findById(id).exec();
  if (!doc) throw new NotFoundException(`${label} no encontrado`);
  return doc;
}

// Cuenta las dependencias y, si hay alguna, rechaza con el detalle de cuales
async function assertUnused(subject: string, checks: [Promise<number>, string][]): Promise<void> {
  const counts = await Promise.all(checks.map(([count]) => count));
  const used = checks.map(([, label], i) => ({ label, count: counts[i] })).filter((c) => c.count > 0);
  if (used.length > 0) {
    const detail = used.map((u) => `${u.count} ${u.label}`).join(', ');
    throw new ConflictException(`No se puede eliminar ${subject}: tiene ${detail}`);
  }
}

function done(resource: string, id: string): Deleted {
  return { deleted: true, resource, id };
}

export function buildDeletionPolicies(deps: DeletionDeps): Map<string, DeletionPolicy> {
  const policies: DeletionPolicy[] = [
    {
      kind: 'groups',
      async execute(id: string): Promise<Deleted> {
        await mustExist(deps.groupModel, id, 'Grupo');
        await assertUnused('el grupo', [
          [deps.enrollmentModel.countDocuments({ group: id }), 'matriculas'],
          [deps.evaluationModel.countDocuments({ group: id }), 'evaluaciones'],
        ]);
        await deps.groupModel.deleteOne({ _id: id });
        return done('groups', id);
      },
    },
    {
      kind: 'evaluations',
      async execute(id: string, ctx?: DeletionContext): Promise<Deleted> {
        // El docente solo borra evaluaciones de sus grupos
        const evaluation = await mustExist<EvaluationDocument>(deps.evaluationModel, id, 'Evaluacion');
        await deps.groupsService.assertCanManage(String(evaluation.group), ctx?.user as AuthUser);
        await assertUnused('la evaluacion', [[deps.gradeModel.countDocuments({ evaluation: id }), 'notas registradas']]);
        await deps.evaluationModel.deleteOne({ _id: id });
        return done('evaluations', id);
      },
    },
    {
      kind: 'grades',
      async execute(id: string, ctx?: DeletionContext): Promise<Deleted> {
        // Corregir una nota puesta por error: solo mientras la matricula siga activa
        const grade = await mustExist<GradeDocument>(deps.gradeModel, id, 'Nota');
        const enrollment = await mustExist<EnrollmentDocument>(deps.enrollmentModel, String(grade.enrollment), 'Matricula');
        await deps.groupsService.assertCanManage(String(enrollment.group), ctx?.user as AuthUser);
        if (enrollment.status !== EnrollmentStatus.Active) {
          throw new ConflictException('No se puede eliminar una nota de una matricula ya finalizada o cancelada');
        }
        await deps.gradeModel.deleteOne({ _id: id });
        return done('grades', id);
      },
    },
    {
      kind: 'notifications',
      async execute(id: string, ctx?: DeletionContext): Promise<Deleted> {
        const notification = await mustExist<NotificationDocument>(deps.notificationModel, id, 'Notificacion');
        // 404 generico para ajenos: no revela si el aviso existe (anti-sondeo)
        if (String(notification.user) !== ctx?.userId) throw new NotFoundException('Notificacion no encontrada');
        await deps.notificationModel.deleteOne({ _id: id });
        return done('notifications', id);
      },
    },
    {
      kind: 'classrooms',
      async execute(id: string): Promise<Deleted> {
        await mustExist(deps.classroomModel, id, 'Salon');
        await assertUnused('el salon', [[deps.groupModel.countDocuments({ 'schedule.classroom': id }), 'grupos con clase en el']]);
        await deps.classroomModel.deleteOne({ _id: id });
        return done('classrooms', id);
      },
    },
    {
      kind: 'faculties',
      async execute(id: string): Promise<Deleted> {
        await mustExist(deps.facultyModel, id, 'Facultad');
        await assertUnused('la facultad', [
          [deps.programModel.countDocuments({ faculty: id }), 'programas'],
          [deps.teacherModel.countDocuments({ faculty: id }), 'docentes'],
        ]);
        await deps.facultyModel.deleteOne({ _id: id });
        return done('faculties', id);
      },
    },
    {
      kind: 'programs',
      async execute(id: string): Promise<Deleted> {
        await mustExist(deps.programModel, id, 'Programa');
        await assertUnused('el programa', [
          [deps.subjectModel.countDocuments({ program: id }), 'materias'],
          [deps.studentModel.countDocuments({ program: id }), 'estudiantes'],
        ]);
        await deps.programModel.deleteOne({ _id: id });
        return done('programs', id);
      },
    },
    {
      kind: 'subjects',
      async execute(id: string): Promise<Deleted> {
        await mustExist(deps.subjectModel, id, 'Materia');
        await assertUnused('la materia', [
          [deps.groupModel.countDocuments({ subject: id }), 'grupos'],
          [deps.enrollmentModel.countDocuments({ subject: id }), 'matriculas'],
          [deps.subjectModel.countDocuments({ prerequisites: id }), 'materias que la tienen como prerrequisito'],
        ]);
        await deps.subjectModel.deleteOne({ _id: id });
        return done('subjects', id);
      },
    },
    {
      kind: 'periods',
      async execute(id: string): Promise<Deleted> {
        // Solo periodos que nunca arrancaron
        const period = await mustExist<PeriodDocument>(deps.periodModel, id, 'Periodo');
        if (period.status !== PeriodStatus.Planned) {
          throw new ConflictException(`Solo se pueden eliminar periodos planificados (este esta ${period.status})`);
        }
        await assertUnused('el periodo', [
          [deps.groupModel.countDocuments({ period: id }), 'grupos'],
          [deps.enrollmentModel.countDocuments({ period: id }), 'matriculas'],
        ]);
        await deps.periodModel.deleteOne({ _id: id });
        return done('periods', id);
      },
    },
    {
      kind: 'students',
      async execute(id: string): Promise<Deleted> {
        await mustExist(deps.studentModel, id, 'Estudiante');
        await assertUnused('el estudiante', [[deps.enrollmentModel.countDocuments({ student: id }), 'matriculas']]);
        await deps.studentModel.deleteOne({ _id: id });
        return done('students', id);
      },
    },
    {
      kind: 'teachers',
      async execute(id: string): Promise<Deleted> {
        await mustExist(deps.teacherModel, id, 'Docente');
        await assertUnused('el docente', [
          [deps.groupModel.countDocuments({ teacher: id }), 'grupos'],
          [deps.facultyModel.countDocuments({ dean: id }), 'facultades de las que es decano'],
        ]);
        await deps.teacherModel.deleteOne({ _id: id });
        return done('teachers', id);
      },
    },
    {
      kind: 'users',
      async execute(id: string, ctx?: DeletionContext): Promise<Deleted> {
        // Un usuario con perfil (estudiante/docente) no se elimina: primero se elimina el perfil
        await mustExist(deps.userModel, id, 'Usuario');
        if (id === ctx?.actor?.id) throw new ConflictException('No puedes eliminar tu propia cuenta');
        await assertUnused('el usuario', [
          [deps.studentModel.countDocuments({ user: id }), 'perfil de estudiante'],
          [deps.teacherModel.countDocuments({ user: id }), 'perfil de docente'],
        ]);
        // Sus avisos se borran con el
        await deps.notificationModel.deleteMany({ user: id });
        await deps.userModel.deleteOne({ _id: id });
        return done('users', id);
      },
    },
  ];
  return new Map(policies.map((p) => [p.kind, p]));
}
