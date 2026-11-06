import { NextResponse } from 'next/server';
import { mutation, parseJson } from '@/lib/api/route';
import { requireUser } from '@/permissions/require';
import {
  addAlias,
  addLandmark,
  createCommune,
  createNeighborhood,
  deleteZoneItem,
  updateNeighborhood,
} from '@/services/backoffice/zones';
import { zoneActionSchema } from '@/validators/zones';

/** POST /api/admin/zones – gestion des communes, quartiers, repères et alias (administrateur). */
export async function POST(request: Request) {
  return mutation(request, async () => {
    const admin = await requireUser(['ADMIN']);
    const parsed = await parseJson(request, zoneActionSchema);
    if ('response' in parsed) return parsed.response;
    const input = parsed.data;
    switch (input.action) {
      case 'createCommune':
        return NextResponse.json({ data: await createCommune(admin, input.data) }, { status: 201 });
      case 'createNeighborhood':
        return NextResponse.json(
          { data: await createNeighborhood(admin, input.data) },
          { status: 201 },
        );
      case 'updateNeighborhood':
        return NextResponse.json({ data: await updateNeighborhood(admin, input.id, input.data) });
      case 'addLandmark':
        return NextResponse.json(
          { data: await addLandmark(admin, input.neighborhoodId, input.data) },
          { status: 201 },
        );
      case 'addAlias':
        return NextResponse.json(
          { data: await addAlias(admin, input.neighborhoodId, input.data) },
          { status: 201 },
        );
      case 'delete':
        return NextResponse.json({ data: await deleteZoneItem(admin, input.kind, input.id) });
    }
  });
}
