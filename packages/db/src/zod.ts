import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { assignment_recipients, assignments } from './schema/assignments';
import { audit_log, news_event_proposals } from './schema/events';
import { media_assets } from './schema/media';
import { reporters } from './schema/reporters';
import { editor_feedback, stories, story_versions } from './schema/stories';

export const insertReporterSchema = createInsertSchema(reporters);
export const selectReporterSchema = createSelectSchema(reporters);

export const insertAssignmentSchema = createInsertSchema(assignments);
export const selectAssignmentSchema = createSelectSchema(assignments);

export const insertAssignmentRecipientSchema = createInsertSchema(assignment_recipients);
export const selectAssignmentRecipientSchema = createSelectSchema(assignment_recipients);

export const insertStorySchema = createInsertSchema(stories);
export const selectStorySchema = createSelectSchema(stories);

export const insertStoryVersionSchema = createInsertSchema(story_versions);
export const selectStoryVersionSchema = createSelectSchema(story_versions);

export const insertEditorFeedbackSchema = createInsertSchema(editor_feedback);
export const selectEditorFeedbackSchema = createSelectSchema(editor_feedback);

export const insertMediaAssetSchema = createInsertSchema(media_assets);
export const selectMediaAssetSchema = createSelectSchema(media_assets);

export const insertNewsEventProposalSchema = createInsertSchema(news_event_proposals);
export const selectNewsEventProposalSchema = createSelectSchema(news_event_proposals);

export const insertAuditLogSchema = createInsertSchema(audit_log);
export const selectAuditLogSchema = createSelectSchema(audit_log);
