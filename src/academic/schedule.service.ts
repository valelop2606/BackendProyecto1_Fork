import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Enrollment, EnrollmentDocument, EnrollmentStatus } from '../enrollments/schemas/enrollment.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { PeriodsService } from '../periods/periods.service';
import { StudentsService } from '../students/students.service';
import { TeachersService } from '../teachers/teachers.service';
import { DAY_ORDER } from './academic.types';
import { loadGroups } from './group-loader';

// Horarios semanales de estudiantes y docentes en un periodo
@Injectable()
export class ScheduleService {
  constructor(
    @InjectModel(Enrollment.name) private readonly enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    private readonly studentsService: StudentsService,
    private readonly teachersService: TeachersService,
    private readonly periodsService: PeriodsService,
  ) {}

  async studentSchedule(studentId: string | null, userId: string | null, periodId?: string) {
    // Estudiante y periodo son independientes: viajan en paralelo
    const [student, period] = await Promise.all([
      studentId ? this.studentsService.findOne(studentId) : this.studentsService.findByUserId(userId as string),
      this.resolvePeriod(periodId),
    ]);

    const enrollments = await this.enrollmentModel
      .find({ student: student.id, period: period.id, status: { $ne: EnrollmentStatus.Cancelled } })
      .select('group status')
      .lean();
    const groups = await loadGroups(this.groupModel, { _id: { $in: enrollments.map((e) => e.group) } });

    const enrollmentByGroup = new Map(enrollments.map((e) => [String(e.group), e.status]));
    const slots = groups.flatMap((g) =>
      g.schedule.map((s) => ({
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        classroom: s.classroom?.code ?? null,
        building: s.classroom?.building ?? null,
        subject: { code: g.subject.code, name: g.subject.name },
        group: g.number,
        teacher: g.teacher?.user?.name ?? null,
        enrollmentStatus: enrollmentByGroup.get(String(g._id)),
      })),
    );

    const owner = student.toObject() as unknown as { _id: Types.ObjectId; code: string; user: { name: string } };
    return {
      student: { id: owner._id, code: owner.code, name: owner.user?.name },
      period: { id: period.id, code: period.code, status: period.status },
      subjects: groups.length,
      credits: groups.reduce((sum, g) => sum + (g.subject.credits ?? 0), 0),
      ...this.arrange(slots),
    };
  }

  async teacherSchedule(teacherId: string | null, userId: string | null, periodId?: string) {
    const [teacher, period] = await Promise.all([
      teacherId ? this.teachersService.findOne(teacherId) : this.teachersService.findByUserId(userId as string),
      this.resolvePeriod(periodId),
    ]);

    const groups = await loadGroups(this.groupModel, { teacher: teacher.id, period: period.id, active: true });
    const slots = groups.flatMap((g) =>
      g.schedule.map((s) => ({
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        classroom: s.classroom?.code ?? null,
        building: s.classroom?.building ?? null,
        subject: { code: g.subject.code, name: g.subject.name },
        group: g.number,
        groupId: g._id,
        enrolled: g.enrolled,
      })),
    );

    const owner = teacher.toObject() as unknown as { _id: Types.ObjectId; code: string; user: { name: string } };
    return {
      teacher: { id: owner._id, code: owner.code, name: owner.user?.name },
      period: { id: period.id, code: period.code, status: period.status },
      groups: groups.length,
      students: groups.reduce((sum, g) => sum + g.enrolled, 0),
      ...this.arrange(slots),
    };
  }

  /* ---------------- utilidades ---------------- */

  private async resolvePeriod(periodId?: string) {
    return periodId ? this.periodsService.findOne(periodId) : this.periodsService.findCurrent();
  }

  // Ordena las franjas por dia y hora y las agrupa por dia (lista plana + mapa por dia)
  private arrange<T extends { day: string; startTime: string }>(slots: T[]) {
    const sorted = [...slots].sort(
      (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startTime.localeCompare(b.startTime),
    );
    const byDay: Record<string, T[]> = {};
    for (const s of sorted) (byDay[s.day] ??= []).push(s);
    return { slots: sorted, byDay };
  }
}
