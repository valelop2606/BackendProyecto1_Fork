import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Enrollment, EnrollmentSchema } from '../enrollments/schemas/enrollment.schema';
import { Evaluation, EvaluationSchema } from '../evaluations/schemas/evaluation.schema';
import { GradesModule } from '../grades/grades.module';
import { Grade, GradeSchema } from '../grades/schemas/grade.schema';
import { GroupsModule } from '../groups/groups.module';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { PeriodsModule } from '../periods/periods.module';
import { Program, ProgramSchema } from '../programs/schemas/program.schema';
import { Subject, SubjectSchema } from '../subjects/schemas/subject.schema';
import { StudentsModule } from '../students/students.module';
import { TeachersModule } from '../teachers/teachers.module';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';
import { GroupGradesService } from './group-grades.service';
import { ProgressService } from './progress.service';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Grade.name, schema: GradeSchema },
      { name: Evaluation.name, schema: EvaluationSchema },
      { name: Program.name, schema: ProgramSchema },
      { name: Subject.name, schema: SubjectSchema },
    ]),
    GroupsModule,
    GradesModule,
    StudentsModule,
    TeachersModule,
    PeriodsModule,
  ],
  controllers: [AcademicController],
  providers: [AcademicService, GroupGradesService, ScheduleService, ProgressService],
})
export class AcademicModule {}
