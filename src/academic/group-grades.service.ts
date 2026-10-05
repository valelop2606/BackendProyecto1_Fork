import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { Enrollment, EnrollmentDocument, EnrollmentStatus } from '../enrollments/schemas/enrollment.schema';
import { Evaluation, EvaluationDocument } from '../evaluations/schemas/evaluation.schema';
import { Grade, GradeDocument } from '../grades/schemas/grade.schema';
import { GradesService } from '../grades/grades.service';
import { GroupsService } from '../groups/groups.service';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Named, PopulatedEnrollment, PopulatedGroup, round2 } from './academic.types';
import { loadGroup } from './group-loader';

// Nomina, planilla y cierre de grupos: todo lo que un docente/admin hace sobre UN grupo
@Injectable()
export class GroupGradesService {
  constructor(
    @InjectModel(Enrollment.name) private readonly enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Grade.name) private readonly gradeModel: Model<GradeDocument>,
    @InjectModel(Evaluation.name) private readonly evaluationModel: Model<EvaluationDocument>,
    private readonly groupsService: GroupsService,
    private readonly gradesService: GradesService,
  ) {}

  async roster(groupId: string, status: EnrollmentStatus | undefined, user: AuthUser) {
    await this.groupsService.assertCanManage(groupId, user);
    // Puerta serial (autorizacion) + abanico paralelo (cargas independientes)
    const [group, enrollments] = await Promise.all([
      loadGroup(this.groupModel, groupId),
      this.groupEnrollments(groupId, status),
    ]);

    return {
      group: this.groupHeader(group),
      total: enrollments.length,
      students: enrollments.map((e) => ({
        enrollment: e._id,
        status: e.status,
        finalGrade: e.finalGrade ?? null,
        student: this.studentInfo(e.student),
      })),
    };
  }

  async gradeSheet(groupId: string, user: AuthUser) {
    await this.groupsService.assertCanManage(groupId, user);
    const [group, evaluations, enrollments] = await Promise.all([
      loadGroup(this.groupModel, groupId),
      this.evaluationModel.find({ group: groupId }).sort({ createdAt: 1, _id: 1 }).lean(),
      this.groupEnrollments(groupId),
    ]);

    const grades = await this.gradeModel.find({ enrollment: { $in: enrollments.map((e) => e._id) } }).lean();
    const byEnrollment = new Map<string, Map<string, number>>();
    for (const g of grades) {
      const key = String(g.enrollment);
      if (!byEnrollment.has(key)) byEnrollment.set(key, new Map());
      byEnrollment.get(key)!.set(String(g.evaluation), g.value);
    }

    const totalWeight = evaluations.reduce((sum, e) => sum + e.weight, 0);
    const planComplete = Math.round(totalWeight * 100) === 10000;

    const rows = enrollments.map((e) => {
      const own = byEnrollment.get(String(e._id)) ?? new Map<string, number>();
      let accumulated = 0;
      let evaluatedWeight = 0;
      const values: Record<string, number | null> = {};
      for (const ev of evaluations) {
        const value = own.get(String(ev._id));
        values[String(ev._id)] = value ?? null;
        if (value !== undefined) {
          accumulated += value * (ev.weight / 100);
          evaluatedWeight += ev.weight;
        }
      }
      const pending = evaluations.length - own.size;
      return {
        enrollment: e._id,
        status: e.status,
        student: this.studentInfo(e.student),
        grades: values,
        evaluatedWeight,
        // Puntos que ya lleva sobre 5.0, y su promedio sobre lo evaluado hasta ahora
        accumulated: round2(accumulated),
        average: evaluatedWeight > 0 ? round2(accumulated / (evaluatedWeight / 100)) : null,
        pendingEvaluations: pending,
        finalGrade: e.finalGrade ?? null,
        readyToFinalize: e.status === EnrollmentStatus.Active && planComplete && pending === 0,
      };
    });

    return {
      group: this.groupHeader(group),
      evaluations: evaluations.map((e) => ({ id: e._id, name: e.name, weight: e.weight })),
      summary: {
        totalWeight,
        planComplete,
        students: rows.length,
        readyToFinalize: rows.filter((r) => r.readyToFinalize).length,
      },
      rows,
    };
  }

  // Finaliza todas las matriculas activas del grupo que ya tienen todas sus notas; informa las que no pudo
  async finalizeGroup(groupId: string, user: AuthUser) {
    await this.groupsService.assertCanManage(groupId, user);
    const [group, active, evaluations] = await Promise.all([
      loadGroup(this.groupModel, groupId),
      this.groupEnrollments(groupId, EnrollmentStatus.Active),
      this.evaluationModel.find({ group: groupId }).select('weight').lean(),
    ]);
    if (active.length === 0) throw new BadRequestException('El grupo no tiene matriculas activas por finalizar');

    const totalWeight = evaluations.reduce((sum, e) => sum + e.weight, 0);
    if (Math.round(totalWeight * 100) !== 10000) {
      throw new BadRequestException(`Los porcentajes del grupo no suman 100 (suman ${totalWeight})`);
    }

    const finalized: { enrollment: Types.ObjectId; student: string; finalGrade: number; status: EnrollmentStatus }[] = [];
    const skipped: { enrollment: Types.ObjectId; student: string; reason: string }[] = [];
    for (const e of active) {
      const label = e.student.code ?? String(e.student._id);
      try {
        const result = await this.gradesService.finalize(String(e._id), user);
        finalized.push({ enrollment: e._id, student: label, finalGrade: result.finalGrade, status: result.status });
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        skipped.push({ enrollment: e._id, student: label, reason: this.messageOf(error) });
      }
    }

    return {
      group: this.groupHeader(group),
      finalized: finalized.length,
      passed: finalized.filter((f) => f.status === EnrollmentStatus.Passed).length,
      failed: finalized.filter((f) => f.status === EnrollmentStatus.Failed).length,
      skipped: skipped.length,
      details: { finalized, skipped },
    };
  }

  /* ---------------- utilidades ---------------- */

  private groupEnrollments(groupId: string, status?: EnrollmentStatus): Promise<PopulatedEnrollment[]> {
    const filter: FilterQuery<EnrollmentDocument> = { group: groupId };
    filter.status = status ?? { $ne: EnrollmentStatus.Cancelled };
    return this.enrollmentModel
      .find(filter)
      .populate({ path: 'student', select: 'code user', populate: { path: 'user', select: 'name email' } })
      .lean()
      .then((list) =>
        (list as unknown as PopulatedEnrollment[]).sort((a, b) => String(a.student.code).localeCompare(String(b.student.code))),
      );
  }

  private groupHeader(group: PopulatedGroup) {
    return {
      id: group._id,
      number: group.number,
      subject: { code: group.subject.code, name: group.subject.name, credits: group.subject.credits },
      period: { code: group.period.code, status: group.period.status },
      teacher: group.teacher?.user?.name ?? null,
      capacity: group.capacity,
      enrolled: group.enrolled,
      availableSeats: Math.max(group.capacity - group.enrolled, 0),
    };
  }

  private studentInfo(student: Named) {
    return { id: student._id, code: student.code, name: student.user?.name, email: student.user?.email };
  }

  private messageOf(error: HttpException): string {
    const res = error.getResponse();
    const message = typeof res === 'string' ? res : (res as { message?: string | string[] }).message;
    return Array.isArray(message) ? message.join('; ') : (message ?? error.message);
  }
}
