import type { DbClient } from './client';
import { reporters } from './schema/reporters';
import { assignments, assignment_recipients } from './schema/assignments';
import { stories } from './schema/stories';

export type SeedReport = {
  reporters: number;
  assignments: number;
  assignment_recipients: number;
  stories: number;
};

export async function isSeeded(client: DbClient): Promise<boolean> {
  const rows = await client.sql<{ exists: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM reporters LIMIT 1) AS exists`;
  return rows[0]?.exists === true;
}

export async function seedDemo(client: DbClient): Promise<SeedReport> {
  if (await isSeeded(client)) {
    throw new Error(
      "Database already seeded. Reset via 'docker compose -f infra/docker-compose.yml down -v' then re-run db:migrate + db:seed.",
    );
  }

  return await client.db.transaction(async (tx) => {
    const insertedReporters = await tx
      .insert(reporters)
      .values([
        {
          email: 'en@aj.now',
          full_name: 'Erin English',
          preferred_lang: 'en',
          languages: ['en'],
        },
        {
          email: 'ar@aj.now',
          full_name: 'Amal Arabic',
          preferred_lang: 'ar',
          languages: ['ar'],
        },
        {
          email: 'bi@aj.now',
          full_name: 'Bilal Bilingual',
          preferred_lang: 'en',
          languages: ['en', 'ar'],
        },
      ])
      .returning();

    const reporterA = insertedReporters[0]!;

    // TODO(phase-2): replace with a real editor FK once the editors/users
    // table lands. Today there's no editors table so created_by is a free
    // uuid; Phase 2 will add a FK constraint that this random value will
    // violate — failure is the intended forcing function for cleanup.
    const placeholderEditor = crypto.randomUUID();

    const insertedAssignments = await tx
      .insert(assignments)
      .values([
        {
          title: 'Open pool: breaking news anywhere',
          brief_md: 'Open-pool assignment available to any reporter.',
          is_open_pool: true,
          priority: 'normal',
          created_by: placeholderEditor,
        },
        {
          title: 'Direct: feature interview',
          brief_md: 'Directly assigned to a specific reporter.',
          is_open_pool: false,
          priority: 'normal',
          created_by: placeholderEditor,
        },
      ])
      .returning();

    const directAssignment = insertedAssignments[1]!;

    const insertedRecipients = await tx
      .insert(assignment_recipients)
      .values([
        {
          assignment_id: directAssignment.id,
          reporter_id: reporterA.id,
          status: 'pending',
        },
      ])
      .returning();

    const insertedStories = await tx
      .insert(stories)
      .values([
        {
          reporter_id: reporterA.id,
          template_key: 'breaking_news',
          title: 'Template: Breaking News',
          status: 'draft',
        },
        {
          reporter_id: reporterA.id,
          template_key: 'feature',
          title: 'Template: Feature',
          status: 'draft',
        },
        {
          reporter_id: reporterA.id,
          template_key: 'interview',
          title: 'Template: Interview',
          status: 'draft',
        },
      ])
      .returning();

    return {
      reporters: insertedReporters.length,
      assignments: insertedAssignments.length,
      assignment_recipients: insertedRecipients.length,
      stories: insertedStories.length,
    };
  });
}
