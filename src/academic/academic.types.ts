import { Types } from 'mongoose';
import { EnrollmentStatus } from '../enrollments/schemas/enrollment.schema';

// Formas (parciales) de los documentos ya poblados. Se leen con lean() para no cargar documentos completos de Mongoose
export interface Named {
  _id: Types.ObjectId;
  code?: string;
  name?: string;
  credits?: number;
  user?: { name?: string; email?: string };
}

export interface PopulatedGroup {
  _id: Types.ObjectId;
  number: number;
  capacity: number;
  enrolled: number;
  active: boolean;
  subject: Named;
  period: { _id: Types.ObjectId; code: string; status: string };
  teacher: Named;
  schedule: { day: string; startTime: string; endTime: string; classroom: { code?: string; building?: string } }[];
}

export interface PopulatedEnrollment {
  _id: Types.ObjectId;
  status: EnrollmentStatus;
  finalGrade?: number;
  student: Named;
  subject: Named;
  group: { _id: Types.ObjectId; number: number };
  period: { _id: Types.ObjectId; code: string; status: string; startDate: Date };
}

export interface CurriculumSubject {
  _id: Types.ObjectId;
  code: string;
  name: string;
  credits: number;
  semester?: number;
  prerequisites: { _id: Types.ObjectId; code: string; name: string }[];
}

export const DAY_ORDER = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

export const round2 = (n: number): number => Math.round(n * 100) / 100;
