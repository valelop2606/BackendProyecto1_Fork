import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Enrollment, EnrollmentDocument, EnrollmentStatus } from '../enrollments/schemas/enrollment.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { PeriodsService } from '../periods/periods.service';
import { Program, ProgramDocument } from '../programs/schemas/program.schema';
import { Subject, SubjectDocument } from '../subjects/schemas/subject.schema';
import { StudentsService } from '../students/students.service';
import { CurriculumSubject, Named, PopulatedEnrollment, PopulatedGroup, round2 } from './academic.types';

// Historial, malla curricular, progreso y oferta disponible: la vista del estudiante sobre su carrera
@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(Enrollment.name) private readonly enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Program.name) private readonly programModel: Model<ProgramDocument>,
    @InjectModel(Subject.name) private readonly subjectModel: Model<SubjectDocument>,
    private readonly studentsService: StudentsService,
    private readonly periodsService: PeriodsService,
  ) {}

  async history(studentId: string | null, userId: string | null) {
    const student = studentId
      ? await this.studentsService.findOne(studentId)
      : await this.studentsService.findByUserId(userId as string);
    const owner = student.toObject() as unknown as {
      _id: Types.ObjectId;
      code: string;
      user: { name: string; email: string };
      program: { _id: Types.ObjectId; code: string; name: string };
    };
    // Programa y matriculas son independientes: viajan en paralelo
    const [program, enrollments] = await Promise.all([
      this.programModel.findById(owner.program._id).lean(),
      this.enrollmentModel
        .find({ student: owner._id, status: { $ne: EnrollmentStatus.Cancelled } })
        .populate('subject', 'code name credits')
        .populate('group', 'number')
        .populate('period', 'code status startDate')
        .lean() as unknown as Promise<PopulatedEnrollment[]>,
    ]);

    const closed = enrollments.filter((e) => e.status === EnrollmentStatus.Passed || e.status === EnrollmentStatus.Failed);
    const passedSubjects = new Map<string, number>(); // materia -> creditos (cada materia aprobada cuenta una vez)
    for (const e of enrollments) {
      if (e.status === EnrollmentStatus.Passed) passedSubjects.set(String(e.subject._id), e.subject.credits ?? 0);
    }
    const creditsApproved = [...passedSubjects.values()].reduce((sum, c) => sum + c, 0);

    const periods = new Map<string, { period: PopulatedEnrollment['period']; items: PopulatedEnrollment[] }>();
    for (const e of enrollments) {
      const key = String(e.period._id);
      if (!periods.has(key)) periods.set(key, { period: e.period, items: [] });
      periods.get(key)!.items.push(e);
    }

    const totalCredits = program?.totalCredits ?? 0;
    return {
      student: { id: owner._id, code: owner.code, name: owner.user?.name, email: owner.user?.email },
      program: { id: owner.program._id, code: owner.program.code, name: owner.program.name, totalCredits },
      summary: {
        creditsApproved,
        creditsRemaining: Math.max(totalCredits - creditsApproved, 0),
        progressPercent: totalCredits > 0 ? Math.round((creditsApproved / totalCredits) * 1000) / 10 : 0,
        gpa: this.gpa(closed),
        subjectsPassed: passedSubjects.size,
        subjectsFailed: closed.filter((e) => e.status === EnrollmentStatus.Failed).length,
        inProgress: enrollments.filter((e) => e.status === EnrollmentStatus.Active).length,
      },
      periods: [...periods.values()]
        .sort((a, b) => +new Date(b.period.startDate) - +new Date(a.period.startDate))
        .map(({ period, items }) => ({
          period: { id: period._id, code: period.code, status: period.status },
          credits: items.reduce((sum, e) => sum + (e.subject.credits ?? 0), 0),
          gpa: this.gpa(items.filter((e) => e.finalGrade !== undefined && e.status !== EnrollmentStatus.Active)),
          courses: items
            .sort((a, b) => String(a.subject.code).localeCompare(String(b.subject.code)))
            .map((e) => ({
              enrollment: e._id,
              subject: { id: e.subject._id, code: e.subject.code, name: e.subject.name, credits: e.subject.credits },
              group: e.group?.number,
              status: e.status,
              finalGrade: e.finalGrade ?? null,
            })),
        })),
    };
  }

  // Materias activas del programa agrupadas por semestre, con sus prerrequisitos
  async curriculum(programId: string) {
    const program = await this.programModel.findById(programId).lean();
    if (!program) throw new NotFoundException('Programa no encontrado');
    const subjects = await this.loadCurriculumSubjects(programId);

    const semesters = new Map<number | null, CurriculumSubject[]>();
    for (const s of subjects) {
      const key = s.semester ?? null;
      if (!semesters.has(key)) semesters.set(key, []);
      semesters.get(key)!.push(s);
    }
    return {
      program: { id: program._id, code: program.code, name: program.name, totalCredits: program.totalCredits },
      subjects: subjects.length,
      semesters: [...semesters.entries()]
        .sort(([a], [b]) => (a ?? 99) - (b ?? 99))
        .map(([semester, list]) => ({
          semester,
          credits: list.reduce((sum, s) => sum + s.credits, 0),
          subjects: list.map((s) => ({
            id: s._id,
            code: s.code,
            name: s.name,
            credits: s.credits,
            prerequisites: s.prerequisites.map((p) => ({ id: p._id, code: p.code, name: p.name })),
          })),
        })),
    };
  }

  // La malla del programa del estudiante marcando que ya aprobo, que cursa y que puede matricular
  async progress(studentId: string | null, userId: string | null) {
    const student = studentId
      ? await this.studentsService.findOne(studentId)
      : await this.studentsService.findByUserId(userId as string);
    const owner = student.toObject() as unknown as {
      _id: Types.ObjectId;
      code: string;
      user: { name: string };
      program: { _id: Types.ObjectId; code: string; name: string };
    };
    // Malla y matriculas son independientes: viajan en paralelo
    const [subjects, enrollments] = await Promise.all([
      this.loadCurriculumSubjects(String(owner.program._id)),
      this.enrollmentModel
        .find({ student: owner._id, status: { $ne: EnrollmentStatus.Cancelled } })
        .select('subject status finalGrade')
        .lean(),
    ]);

    const passed = new Set(enrollments.filter((e) => e.status === EnrollmentStatus.Passed).map((e) => String(e.subject)));
    const active = new Set(enrollments.filter((e) => e.status === EnrollmentStatus.Active).map((e) => String(e.subject)));
    const failed = new Set(enrollments.filter((e) => e.status === EnrollmentStatus.Failed).map((e) => String(e.subject)));

    const rows = subjects.map((s) => {
      const id = String(s._id);
      const status = passed.has(id) ? 'aprobada' : active.has(id) ? 'cursando' : failed.has(id) ? 'reprobada' : 'pendiente';
      const missing = s.prerequisites.filter((p) => !passed.has(String(p._id)));
      return {
        id: s._id,
        code: s.code,
        name: s.name,
        credits: s.credits,
        semester: s.semester ?? null,
        status,
        missingPrerequisites: missing.map((p) => p.code),
        canEnroll: (status === 'pendiente' || status === 'reprobada') && missing.length === 0,
      };
    });
    const count = (st: string) => rows.filter((r) => r.status === st).length;
    const creditsOf = (st: string) => rows.filter((r) => r.status === st).reduce((sum, r) => sum + r.credits, 0);

    return {
      student: { id: owner._id, code: owner.code, name: owner.user?.name },
      program: { id: owner.program._id, code: owner.program.code, name: owner.program.name },
      summary: {
        subjects: rows.length,
        passed: count('aprobada'),
        inProgress: count('cursando'),
        failed: count('reprobada'),
        pending: count('pendiente'),
        creditsApproved: creditsOf('aprobada'),
        creditsTotal: rows.reduce((sum, r) => sum + r.credits, 0),
      },
      subjects: rows,
    };
  }

  // Grupos del periodo abierto que el estudiante SI puede matricular: con cupo, prerrequisitos cumplidos,
  // materia no aprobada ni cursada en el periodo. Por defecto solo de su programa (all=true para todos)
  async availableGroups(userId: string, all: boolean) {
    // Estudiante y periodo abierto son independientes: viajan en paralelo
    const [student, period] = await Promise.all([
      this.studentsService.findByUserId(userId),
      this.periodsService.findCurrent(),
    ]);
    const owner = student.toObject() as unknown as { _id: Types.ObjectId; program: { _id: Types.ObjectId } };

    // Matriculas previas y grupos con cupo son independientes: viajan en paralelo
    const [enrollments, groups] = await Promise.all([
      this.enrollmentModel
        .find({ student: owner._id, status: { $ne: EnrollmentStatus.Cancelled } })
        .select('subject period status')
        .lean(),
      this.groupModel
        .find({ period: period._id, active: true, $expr: { $lt: ['$enrolled', '$capacity'] } })
        .populate({ path: 'subject', select: 'code name credits program prerequisites active' })
        .populate({ path: 'teacher', select: 'code user', populate: { path: 'user', select: 'name' } })
        .populate('schedule.classroom', 'code building')
        .lean(),
    ]);
    const passed = new Set(enrollments.filter((e) => e.status === EnrollmentStatus.Passed).map((e) => String(e.subject)));
    const takenNow = new Set(enrollments.filter((e) => String(e.period) === period.id).map((e) => String(e.subject)));

    const rows = (
      groups as unknown as (Omit<PopulatedGroup, 'subject'> & {
        subject: Named & {
          program: Types.ObjectId;
          prerequisites: Types.ObjectId[];
          active: boolean;
        };
      })[]
    )
      .filter((g) => {
        const id = String(g.subject._id);
        if (!g.subject.active || passed.has(id) || takenNow.has(id)) return false;
        if (!all && String(g.subject.program) !== String(owner.program._id)) return false;
        return g.subject.prerequisites.every((p) => passed.has(String(p)));
      })
      .map((g) => ({
        group: g._id,
        number: g.number,
        subject: { id: g.subject._id, code: g.subject.code, name: g.subject.name, credits: g.subject.credits },
        teacher: g.teacher?.user?.name ?? null,
        capacity: g.capacity,
        availableSeats: Math.max(g.capacity - g.enrolled, 0),
        schedule: g.schedule.map((s) => ({
          day: s.day,
          startTime: s.startTime,
          endTime: s.endTime,
          classroom: s.classroom?.code ?? null,
        })),
      }))
      .sort((a, b) => String(a.subject.code).localeCompare(String(b.subject.code)) || a.number - b.number);

    return { period: { id: period.id, code: period.code }, total: rows.length, groups: rows };
  }

  /* ---------------- utilidades ---------------- */

  private async loadCurriculumSubjects(programId: string): Promise<CurriculumSubject[]> {
    return (await this.subjectModel
      .find({ program: programId, active: true })
      .populate('prerequisites', 'code name')
      .sort({ semester: 1, code: 1 })
      .lean()) as unknown as CurriculumSubject[];
  }

  // Promedio ponderado por creditos de las matriculas ya cerradas (null si no hay ninguna)
  private gpa(items: PopulatedEnrollment[]): number | null {
    const graded = items.filter((e) => e.finalGrade !== undefined && e.finalGrade !== null);
    const credits = graded.reduce((sum, e) => sum + (e.subject.credits ?? 0), 0);
    if (credits === 0) return null;
    return round2(graded.reduce((sum, e) => sum + (e.finalGrade as number) * (e.subject.credits ?? 0), 0) / credits);
  }
}
