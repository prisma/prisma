const REVIEW_ACTIONS_VERSION = 2;
const TARGET_KIND_VALUES = new Set([
  'review_thread',
  'review_comment',
  'pull_request_review',
  'issue_comment',
]);
const DECISION_VALUES = new Set([
  'triage_pending',
  'will_address',
  'defer',
  'out_of_scope',
  'already_fixed',
  'not_actionable',
  'wont_address',
]);
const STATUS_VALUES = new Set(['pending', 'in_progress', 'done']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function assertReviewActionsV1(reviewActions) {
  if (typeof reviewActions !== 'object' || reviewActions === null) {
    throw new TypeError('review-actions must be an object');
  }
  if (reviewActions.version !== REVIEW_ACTIONS_VERSION) {
    throw new TypeError(`review-actions version must be ${REVIEW_ACTIONS_VERSION}`);
  }
  if (typeof reviewActions.pr !== 'object' || reviewActions.pr === null) {
    throw new TypeError('review-actions pr must be an object');
  }
  if (!isNonEmptyString(reviewActions.pr.url)) {
    throw new TypeError('review-actions pr.url must be a non-empty string');
  }
  if (typeof reviewActions.reviewState !== 'object' || reviewActions.reviewState === null) {
    throw new TypeError('review-actions reviewState must be an object');
  }
  if (!isNonEmptyString(reviewActions.reviewState.path)) {
    throw new TypeError('review-actions reviewState.path must be a non-empty string');
  }
  if (!isNonEmptyString(reviewActions.reviewState.fetchedAt)) {
    throw new TypeError('review-actions reviewState.fetchedAt must be a non-empty string');
  }
  if (reviewActions.reviewState.version !== 2) {
    throw new TypeError('review-actions reviewState.version must be 2');
  }
  if (!Array.isArray(reviewActions.actions)) {
    throw new TypeError('review-actions actions must be an array');
  }

  const seenActionIds = new Set();
  for (let index = 0; index < reviewActions.actions.length; index += 1) {
    const action = reviewActions.actions[index];
    const pointer = `review-actions actions[${index}]`;
    if (!isNonEmptyString(action?.actionId)) {
      throw new TypeError(`${pointer}.actionId must be a non-empty string`);
    }
    if (seenActionIds.has(action.actionId)) {
      throw new TypeError(`${pointer}.actionId must be unique`);
    }
    seenActionIds.add(action.actionId);
    if (typeof action?.target !== 'object' || action.target === null) {
      throw new TypeError(`${pointer}.target must be an object`);
    }
    if (!TARGET_KIND_VALUES.has(action.target.kind)) {
      throw new TypeError(`${pointer}.target.kind must be a supported value`);
    }
    if (!isNonEmptyString(action.target.nodeId)) {
      throw new TypeError(`${pointer}.target.nodeId must be a non-empty string`);
    }
    if (!DECISION_VALUES.has(action?.decision)) {
      throw new TypeError(`${pointer}.decision must be a supported value`);
    }
    if (action.decision === 'wont_address' && !isNonEmptyString(action?.rationale)) {
      throw new TypeError(
        `${pointer}.rationale must be a non-empty string when decision is wont_address`,
      );
    }
    if (action.decision !== 'triage_pending' && !isNonEmptyString(action?.summary)) {
      throw new TypeError(`${pointer}.summary must be a non-empty string once triaged`);
    }
    if (
      action.summary !== null &&
      action.summary !== undefined &&
      typeof action.summary !== 'string'
    ) {
      throw new TypeError(`${pointer}.summary must be a string or null`);
    }
    if (
      action.rationale !== null &&
      action.rationale !== undefined &&
      typeof action.rationale !== 'string'
    ) {
      throw new TypeError(`${pointer}.rationale must be a string or null`);
    }
    if (
      action.linearIssue !== null &&
      action.linearIssue !== undefined &&
      typeof action.linearIssue !== 'string'
    ) {
      throw new TypeError(`${pointer}.linearIssue must be a string or null`);
    }
    if (action.decision === 'defer' && !isNonEmptyString(action?.linearIssue)) {
      throw new TypeError(`${pointer}.linearIssue must be set when decision is defer`);
    }
    if (!Array.isArray(action?.targetFiles)) {
      throw new TypeError(`${pointer}.targetFiles must be an array`);
    }
    for (let i = 0; i < action.targetFiles.length; i += 1) {
      if (!isNonEmptyString(action.targetFiles[i])) {
        throw new TypeError(`${pointer}.targetFiles[${i}] must be a non-empty string`);
      }
    }
    if (
      action.acceptance !== null &&
      action.acceptance !== undefined &&
      typeof action.acceptance !== 'string'
    ) {
      throw new TypeError(`${pointer}.acceptance must be a string or null`);
    }
    if (
      action.status === 'done' &&
      (typeof action.done !== 'object' ||
        action.done === null ||
        !isNonEmptyString(action.done.doneAt))
    ) {
      throw new TypeError(`${pointer}.done.doneAt must be present when status is done`);
    }
    if (action.done !== null && action.done !== undefined) {
      if (typeof action.done !== 'object') {
        throw new TypeError(`${pointer}.done must be an object or null`);
      }
      if (!isNonEmptyString(action.done.doneAt)) {
        throw new TypeError(`${pointer}.done.doneAt must be a non-empty string`);
      }
      if (
        action.done.summary !== null &&
        action.done.summary !== undefined &&
        typeof action.done.summary !== 'string'
      ) {
        throw new TypeError(`${pointer}.done.summary must be a string or null`);
      }
      if (!Array.isArray(action.done.commits)) {
        throw new TypeError(`${pointer}.done.commits must be an array`);
      }
      for (let commitIndex = 0; commitIndex < action.done.commits.length; commitIndex += 1) {
        if (!isNonEmptyString(action.done.commits[commitIndex])) {
          throw new TypeError(`${pointer}.done.commits[${commitIndex}] must be a non-empty string`);
        }
      }
    }
    if (!STATUS_VALUES.has(action?.status)) {
      throw new TypeError(`${pointer}.status must be one of pending|in_progress|done`);
    }
  }
  return reviewActions;
}

export { assertReviewActionsV1, REVIEW_ACTIONS_VERSION };
