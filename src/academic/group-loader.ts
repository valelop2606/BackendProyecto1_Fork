import { NotFoundException } from '@nestjs/common';
import { FilterQuery, Model } from 'mongoose';
import { GroupDocument } from '../groups/schemas/group.schema';
import { PopulatedGroup } from './academic.types';

// Carga compartida de grupos poblados (una sola consulta con populates, sin N+1)
export async function loadGroups(
  groupModel: Model<GroupDocument>,
  filter: FilterQuery<GroupDocument>,
): Promise<PopulatedGroup[]> {
  return (await groupModel
    .find(filter)
    .populate('subject', 'code name credits')
    .populate('period', 'code status')
    .populate({ path: 'teacher', select: 'code user', populate: { path: 'user', select: 'name' } })
    .populate('schedule.classroom', 'code building')
    .lean()) as unknown as PopulatedGroup[];
}

export async function loadGroup(groupModel: Model<GroupDocument>, id: string): Promise<PopulatedGroup> {
  const [group] = await loadGroups(groupModel, { _id: id });
  if (!group) throw new NotFoundException('Grupo no encontrado');
  return group;
}
