import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { AcademicModule } from './academic/academic.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { DeletionsModule } from './deletions/deletions.module';
import { ClassroomsModule } from './classrooms/classrooms.module';
import { FacultiesModule } from './faculties/faculties.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { GradesModule } from './grades/grades.module';
import { GroupsModule } from './groups/groups.module';
import { HealthModule } from './health/health.module';
import { PeriodsModule } from './periods/periods.module';
import { ProgramsModule } from './programs/programs.module';
import { ReportsModule } from './reports/reports.module';
import { StudentsModule } from './students/students.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TeachersModule } from './teachers/teachers.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
    }),
    // Tasa global + ventana estricta para el login (el abuso se deniega con 429)
    ThrottlerModule.forRoot([
      { ttl: 60000, limit: 100 },
      { name: 'login', ttl: 60000, limit: 10 },
    ]),
    HealthModule,
    UsersModule,
    AuthModule,
    ProgramsModule,
    SubjectsModule,
    PeriodsModule,
    StudentsModule,
    TeachersModule,
    GroupsModule,
    EnrollmentsModule,
    EvaluationsModule,
    GradesModule,
    ClassroomsModule,
    FacultiesModule,
    NotificationsModule,
    AcademicModule,
    ReportsModule,
    DeletionsModule,
  ],
})
export class AppModule {}