import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { Classroom, ClassroomDocument } from '../classrooms/schemas/classroom.schema';
import { Enrollment, EnrollmentDocument } from '../enrollments/schemas/enrollment.schema';
import { Evaluation, EvaluationDocument } from '../evaluations/schemas/evaluation.schema';
import { Faculty, FacultyDocument } from '../faculties/schemas/faculty.schema';
import { Grade, GradeDocument } from '../grades/schemas/grade.schema';
import { GroupsService } from '../groups/groups.service';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Notification, NotificationDocument } from '../notifications/schemas/notification.schema';
import { Period, PeriodDocument } from '../periods/schemas/period.schema';
import { Program, ProgramDocument } from '../programs/schemas/program.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Subject, SubjectDocument } from '../subjects/schemas/subject.schema';
import { Teacher, TeacherDocument } from '../teachers/schemas/teacher.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { buildDeletionPolicies, DeletionPolicy } from './deletion-policies';

export interface Deleted {
  deleted: true;
  resource: string;
  id: string;
}

// Un registro NO se elimina si otros registros dependen de el: asi no quedan referencias rotas.
// Para "apagar" algo sin borrarlo, cada recurso tiene su campo 'active' (PATCH).
// Las reglas viven en deletion-policies.ts (una estrategia por agregado); aqui solo se enrutan.
@Injectable()
export class DeletionsService {
  private readonly policies: Map<string, DeletionPolicy>;

  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Enrollment.name) private readonly enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel(Evaluation.name) private readonly evaluationModel: Model<EvaluationDocument>,
    @InjectModel(Grade.name) private readonly gradeModel: Model<GradeDocument>,
    @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(Classroom.name) private readonly classroomModel: Model<ClassroomDocument>,
    @InjectModel(Faculty.name) private readonly facultyModel: Model<FacultyDocument>,
    @InjectModel(Program.name) private readonly programModel: Model<ProgramDocument>,
    @InjectModel(Subject.name) private readonly subjectModel: Model<SubjectDocument>,
    @InjectModel(Period.name) private readonly periodModel: Model<PeriodDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Teacher.name) private readonly teacherModel: Model<TeacherDocument>,
    private readonly groupsService: GroupsService,
  ) {
    this.policies = buildDeletionPolicies({
      groupModel: this.groupModel,
      enrollmentModel: this.enrollmentModel,
      evaluationModel: this.evaluationModel,
      gradeModel: this.gradeModel,
      notificationModel: this.notificationModel,
      classroomModel: this.classroomModel,
      facultyModel: this.facultyModel,
      programModel: this.programModel,
      subjectModel: this.subjectModel,
      periodModel: this.periodModel,
      userModel: this.userModel,
      studentModel: this.studentModel,
      teacherModel: this.teacherModel,
      groupsService: this.groupsService,
    });
  }

  private policy(kind: string): DeletionPolicy {
    const found = this.policies.get(kind);
    if (!found) throw new NotFoundException(`Recurso no soportado: ${kind}`);
    return found;
  }

  async removeGroup(id: string): Promise<Deleted> {
    return this.policy('groups').execute(id);
  }

  async removeEvaluation(id: string, user: AuthUser): Promise<Deleted> {
    return this.policy('evaluations').execute(id, { user });
  }

  async removeGrade(id: string, user: AuthUser): Promise<Deleted> {
    return this.policy('grades').execute(id, { user });
  }

  async removeNotification(id: string, userId: string): Promise<Deleted> {
    return this.policy('notifications').execute(id, { userId });
  }

  async removeClassroom(id: string): Promise<Deleted> {
    return this.policy('classrooms').execute(id);
  }

  async removeFaculty(id: string): Promise<Deleted> {
    return this.policy('faculties').execute(id);
  }

  async removeProgram(id: string): Promise<Deleted> {
    return this.policy('programs').execute(id);
  }

  async removeSubject(id: string): Promise<Deleted> {
    return this.policy('subjects').execute(id);
  }

  async removePeriod(id: string): Promise<Deleted> {
    return this.policy('periods').execute(id);
  }

  async removeStudent(id: string): Promise<Deleted> {
    return this.policy('students').execute(id);
  }

  async removeTeacher(id: string): Promise<Deleted> {
    return this.policy('teachers').execute(id);
  }

  async removeUser(id: string, actor: AuthUser): Promise<Deleted> {
    return this.policy('users').execute(id, { actor });
  }
}
