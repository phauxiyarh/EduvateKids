/**
 * Summer Reads reminder email content + template — re-export.
 *
 * The canonical file is functions/src/summerReminderEmail.ts. A Cloud Function
 * deploys from its own directory and cannot package a file outside it, and
 * widening its tsconfig to reach ../lib moves the whole build output (rootDir
 * becomes the parent, so lib/index.js becomes lib/functions/src/index.js and
 * the package main breaks). Keeping the original under functions/src and
 * re-exporting it here avoids both problems.
 *
 * One definition is the whole point: the preview and the real send must render
 * from the same template, or the preview stops being evidence of anything.
 */
export {
  DEFAULT_REMINDER_CONTENT,
  normalizeReminderContent,
  buildReminderEmail
} from '../functions/src/summerReminderEmail'
export type {
  ReminderContent,
  ReminderFaq
} from '../functions/src/summerReminderEmail'
