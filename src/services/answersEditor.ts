/**
 * One way to change your details anywhere in the workspace: every "Edit answers" or "Set up" button opens
 * the same saved sign-up answers (RequiredOnboarding in edit mode). Saving updates every page at once.
 */
export const EDIT_ANSWERS_EVENT = 'arthamind:edit-answers';
export function openAnswersEditor() { window.dispatchEvent(new CustomEvent(EDIT_ANSWERS_EVENT)); }
