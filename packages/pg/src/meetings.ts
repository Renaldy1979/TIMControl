import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { MeetingKind } from "@timcontrol/shared";
import type { Tx } from "./client";
import { cards, meetingParticipants, meetings, projects, users } from "./schema";

/** Reuniões e WarRooms (Lote 2). O RLS recorta pela matriz "Reuniões" do perfil que vale em cada projeto. */

export interface MeetingSummary {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  kind: MeetingKind;
  title: string;
  heldOn: string;
  createdBy: string;
  openCards: number;
  totalCards: number;
}

export interface MeetingDetail extends MeetingSummary {
  notes: string;
  createdByName: string;
  participants: { id: string; name: string }[];
}

const counts = {
  openCards: sql<number>`(select count(*)::int from ${cards} c where c.meeting_id = ${meetings.id} and c.status <> 'done')`,
  totalCards: sql<number>`(select count(*)::int from ${cards} c where c.meeting_id = ${meetings.id})`,
};

export async function listMeetings(tx: Tx, f: { projectIds?: string[]; kind?: MeetingKind } = {}): Promise<MeetingSummary[]> {
  const where: SQL[] = [];
  if (f.projectIds) {
    if (!f.projectIds.length) return [];
    where.push(inArray(meetings.projectId, f.projectIds));
  }
  if (f.kind) where.push(eq(meetings.kind, f.kind));
  const rows = await tx
    .select({
      id: meetings.id,
      projectId: meetings.projectId,
      projectName: projects.name,
      projectColor: projects.color,
      kind: meetings.kind,
      title: meetings.title,
      heldOn: meetings.heldOn,
      createdBy: meetings.createdBy,
      ...counts,
    })
    .from(meetings)
    .innerJoin(projects, eq(projects.id, meetings.projectId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(meetings.heldOn), desc(meetings.createdAt))
    .limit(500);
  return rows as MeetingSummary[];
}

export async function getMeeting(tx: Tx, id: string): Promise<MeetingDetail | null> {
  const [m] = await tx
    .select({
      id: meetings.id,
      projectId: meetings.projectId,
      projectName: projects.name,
      projectColor: projects.color,
      kind: meetings.kind,
      title: meetings.title,
      heldOn: meetings.heldOn,
      notes: meetings.notes,
      createdBy: meetings.createdBy,
      createdByName: users.name,
      ...counts,
    })
    .from(meetings)
    .innerJoin(projects, eq(projects.id, meetings.projectId))
    .innerJoin(users, eq(users.id, meetings.createdBy))
    .where(eq(meetings.id, id));
  if (!m) return null;
  const participants = await tx
    .select({ id: users.id, name: users.name })
    .from(meetingParticipants)
    .innerJoin(users, eq(users.id, meetingParticipants.userId))
    .where(eq(meetingParticipants.meetingId, id))
    .orderBy(asc(users.name));
  return { ...(m as Omit<MeetingDetail, "participants">), participants };
}

export interface MeetingWrite {
  projectId: string;
  kind: MeetingKind;
  title: string;
  heldOn: string;
  notes: string;
}

export async function insertMeeting(tx: Tx, createdBy: string, input: MeetingWrite): Promise<string> {
  const [m] = await tx.insert(meetings).values({ ...input, createdBy }).returning({ id: meetings.id });
  return m!.id;
}

export async function updateMeeting(tx: Tx, id: string, input: MeetingWrite): Promise<boolean> {
  const r = await tx
    .update(meetings)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(meetings.id, id))
    .returning({ id: meetings.id });
  return r.length > 0;
}

export async function deleteMeeting(tx: Tx, id: string): Promise<boolean> {
  const r = await tx.delete(meetings).where(eq(meetings.id, id)).returning({ id: meetings.id });
  return r.length > 0;
}

export async function setMeetingParticipants(tx: Tx, meetingId: string, userIds: string[]): Promise<void> {
  await tx.delete(meetingParticipants).where(eq(meetingParticipants.meetingId, meetingId));
  const unique = [...new Set(userIds)];
  if (unique.length) await tx.insert(meetingParticipants).values(unique.map((userId) => ({ meetingId, userId })));
}
