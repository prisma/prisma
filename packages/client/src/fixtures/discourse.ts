export const discourse = `
datasource db {
  provider = "postgresql"
  url      = "postgresql://localhost:5432/db"
}

model ApiKey {
  id Int @id
  createdAt DateTime @map("created_at")
  createdById Int? @map("created_by_id")
  hidden Boolean
  key String
  updatedAt DateTime @map("updated_at")
  userId Int? @map("user_id") @unique
  @@map("api_keys")
}

model ApplicationRequest {
  id Int @id
  count Int
  date DateTime
  reqType Int @map("req_type")
  @@map("application_requests")
}

model ArInternalMetadatum {
  key String @default(cuid()) @id
  createdAt DateTime @map("created_at")
  updatedAt DateTime @map("updated_at")
  value String?
  @@map("ar_internal_metadata")
}

model Badge {
  id Int @id
  allowTitle Boolean @map("allow_title")
  autoRevoke Boolean @map("auto_revoke")
  badgeGroupingId Int @map("badge_grouping_id")
  badgeTypeId Int @map("badge_type_id")
  createdAt DateTime @map("created_at")
  description String?
  enabled Boolean
  grantCount Int @map("grant_count")
  icon String?
  image String?
  listable Boolean?
  longDescription String? @map("long_description")
  multipleGrant Boolean @map("multiple_grant")
  name String @unique
  query String?
  showPosts Boolean @map("show_posts")
  system Boolean
  targetPosts Boolean? @map("target_posts")
  trigger Int?
  updatedAt DateTime @map("updated_at")
  @@map("badges")
}

model BadgeGrouping {
  id Int @id
  createdAt DateTime @map("created_at")
  description String?
  name String
  position Int
  updatedAt DateTime @map("updated_at")
  @@map("badge_groupings")
}

model BadgeType {
  id Int @id
  createdAt DateTime @map("created_at")
  name String @unique
  updatedAt DateTime @map("updated_at")
  @@map("badge_types")
}

model Category {
  id Int @id
  allowBadges Boolean @map("allow_badges")
  allTopicsWiki Boolean @map("all_topics_wiki")
  autoCloseBasedOnLastPost Boolean? @map("auto_close_based_on_last_post")
  autoCloseHours Float? @map("auto_close_hours")
  color String
  containsMessages Boolean? @map("contains_messages")
  createdAt DateTime @map("created_at")
  defaultTopPeriod String? @map("default_top_period")
  defaultView String? @map("default_view")
  description String?
  emailIn String? @map("email_in") @unique
  emailInAllowStrangers Boolean? @map("email_in_allow_strangers")
  latestPostId Int? @map("latest_post_id")
  latestTopicId Int? @map("latest_topic_id")
  mailinglistMirror Boolean @map("mailinglist_mirror")
  minimumRequiredTags Int? @map("minimum_required_tags")
  name String @unique
  nameLower String @map("name_lower")
  navigateToFirstPostAfterRead Boolean @map("navigate_to_first_post_after_read")
  numFeaturedTopics Int? @map("num_featured_topics")
  parentCategoryId Int? @map("parent_category_id")
  position Int?
  postCount Int @map("post_count")
  postsDay Int? @map("posts_day")
  postsMonth Int? @map("posts_month")
  postsWeek Int? @map("posts_week")
  postsYear Int? @map("posts_year")
  readRestricted Boolean @map("read_restricted")
  showSubcategoryList Boolean? @map("show_subcategory_list")
  slug String
  sortAscending Boolean? @map("sort_ascending")
  sortOrder String? @map("sort_order")
  subcategoryListStyle String? @map("subcategory_list_style")
  suppressFromLatest Boolean? @map("suppress_from_latest")
  textColor String @map("text_color")
  topicCount Int @map("topic_count")
  topicFeaturedLinkAllowed Boolean? @map("topic_featured_link_allowed")
  topicId Int? @map("topic_id")
  topicsDay Int? @map("topics_day")
  topicsMonth Int? @map("topics_month")
  topicsWeek Int? @map("topics_week")
  topicsYear Int? @map("topics_year")
  topicTemplate String? @map("topic_template")
  updatedAt DateTime @map("updated_at")
  uploadedBackgroundId Int? @map("uploaded_background_id")
  uploadedLogoId Int? @map("uploaded_logo_id")
  userId Int @map("user_id")
  @@map("categories")
}

model CategoryCustomField {
  id Int @id
  categoryId Int @map("category_id")
  createdAt DateTime @map("created_at")
  name String
  updatedAt DateTime @map("updated_at")
  value String?
  @@map("category_custom_fields")
}

model CategoryFeaturedTopic {
  id Int @id
  categoryId Int @map("category_id")
  createdAt DateTime @map("created_at")
  rank Int
  topicId Int @map("topic_id")
  updatedAt DateTime @map("updated_at")
  @@map("category_featured_topics")
}

model CategoryGroup {
  id Int @id
  categoryId Int @map("category_id")
  createdAt DateTime @map("created_at")
  groupId Int @map("group_id")
  permissionType Int? @map("permission_type")
  updatedAt DateTime @map("updated_at")
  @@map("category_groups")
}

model CategorySearchDatum {
  category_id Int @id
  locale String?
  rawData String? @map("raw_data")
  version Int?
  @@map("category_search_data")
}

model CategoryTag {
  id Int @id
  categoryId Int @map("category_id")
  createdAt DateTime? @map("created_at")
  tagId Int @map("tag_id")
  updatedAt DateTime? @map("updated_at")
  @@map("category_tags")
}

model CategoryTagGroup {
  id Int @id
  categoryId Int @map("category_id")
  createdAt DateTime? @map("created_at")
  tagGroupId Int @map("tag_group_id")
  updatedAt DateTime? @map("updated_at")
  @@map("category_tag_groups")
}

model CategoryTagStat {
  id Int @id
  categoryId Int @map("category_id")
  tagId Int @map("tag_id")
  topicCount Int @map("topic_count")
  @@map("category_tag_stats")
}

model CategoryUser {
  id Int @id
  categoryId Int @map("category_id")
  notificationLevel Int @map("notification_level")
  userId Int @map("user_id")
  @@map("category_users")
}

model ChildTheme {
  id Int @id
  childThemeId Int? @map("child_theme_id")
  createdAt DateTime? @map("created_at")
  parentThemeId Int? @map("parent_theme_id")
  updatedAt DateTime? @map("updated_at")
  @@map("child_themes")
}

model ColorScheme {
  id Int @id
  baseSchemeId String? @map("base_scheme_id")
  createdAt DateTime @map("created_at")
  name String
  themeId Int? @map("theme_id")
  updatedAt DateTime @map("updated_at")
  version Int
  viaWizard Boolean @map("via_wizard")
  @@map("color_schemes")
}

model ColorSchemeColor {
  id Int @id
  colorSchemeId Int @map("color_scheme_id")
  createdAt DateTime @map("created_at")
  hex String
  name String
  updatedAt DateTime @map("updated_at")
  @@map("color_scheme_colors")
}

model CustomEmoji {
  id Int @id
  createdAt DateTime @map("created_at")
  name String @unique
  updatedAt DateTime @map("updated_at")
  uploadId Int @map("upload_id")
  @@map("custom_emojis")
}

model Developer {
  id Int @id
  userId Int @map("user_id")
  @@map("developers")
}

model DirectoryItem {
  id Int @id
  createdAt DateTime? @map("created_at")
  daysVisited Int @map("days_visited")
  likesGiven Int @map("likes_given")
  likesReceived Int @map("likes_received")
  periodType Int @map("period_type")
  postCount Int @map("post_count")
  postsRead Int @map("posts_read")
  topicCount Int @map("topic_count")
  topicsEntered Int @map("topics_entered")
  updatedAt DateTime? @map("updated_at")
  userId Int @map("user_id")
  @@map("directory_items")
}

model Draft {
  id Int @id
  createdAt DateTime @map("created_at")
  data String
  draftKey String @map("draft_key")
  revisions Int
  sequence Int
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  @@map("drafts")
}

model DraftSequence {
  id Int @id
  draftKey String @map("draft_key")
  sequence Int
  userId Int @map("user_id")
  @@map("draft_sequences")
}

model EmailChangeRequest {
  id Int @id
  changeState Int @map("change_state")
  createdAt DateTime @map("created_at")
  newEmail String @map("new_email")
  newEmailTokenId Int? @map("new_email_token_id")
  oldEmail String @map("old_email")
  oldEmailTokenId Int? @map("old_email_token_id")
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  @@map("email_change_requests")
}

model EmailLog {
  id Int @id
  bounced Boolean
  bounceKey String? @map("bounce_key") @default(uuid())
  createdAt DateTime @map("created_at")
  emailType String @map("email_type")
  messageId String? @map("message_id")
  postId Int? @map("post_id")
  toAddress String @map("to_address")
  updatedAt DateTime @map("updated_at")
  userId Int? @map("user_id")
  @@map("email_logs")
}

model EmailToken {
  id Int @id
  confirmed Boolean
  createdAt DateTime @map("created_at")
  email String
  expired Boolean
  token String @unique
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  @@map("email_tokens")
}

model EmbeddableHost {
  id Int @id
  categoryId Int @map("category_id")
  className String? @map("class_name")
  createdAt DateTime? @map("created_at")
  host String
  pathWhitelist String? @map("path_whitelist")
  updatedAt DateTime? @map("updated_at")
  @@map("embeddable_hosts")
}

model FacebookUserInfo {
  id Int @id
  aboutMe String? @map("about_me")
  avatarUrl String? @map("avatar_url")
  createdAt DateTime @map("created_at")
  email String?
  facebookUserId Int @map("facebook_user_id") @unique
  firstName String? @map("first_name")
  gender String?
  lastName String? @map("last_name")
  link String?
  location String?
  name String?
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id") @unique
  username String?
  website String?
  @@map("facebook_user_infos")
}

model GitHubUserInfo {
  id Int @id
  createdAt DateTime @map("created_at")
  githubUserId Int @map("github_user_id") @unique
  screenName String @map("screen_name")
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id") @unique
  @@map("github_user_infos")
}

model GoogleUserInfo {
  id Int @id
  createdAt DateTime @map("created_at")
  email String?
  firstName String? @map("first_name")
  gender String?
  googleUserId String @map("google_user_id") @unique
  lastName String? @map("last_name")
  link String?
  name String?
  picture String?
  profileLink String? @map("profile_link")
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id") @unique
  @@map("google_user_infos")
}

model Group {
  id Int @id
  allowMembershipRequests Boolean @map("allow_membership_requests")
  automatic Boolean
  automaticMembershipEmailDomains String? @map("automatic_membership_email_domains")
  automaticMembershipRetroactive Boolean? @map("automatic_membership_retroactive")
  bioCooked String? @map("bio_cooked")
  bioRaw String? @map("bio_raw")
  createdAt DateTime @map("created_at")
  defaultNotificationLevel Int @map("default_notification_level")
  flairBgColor String? @map("flair_bg_color")
  flairColor String? @map("flair_color")
  flairUrl String? @map("flair_url")
  fullName String? @map("full_name")
  grantTrustLevel Int? @map("grant_trust_level")
  hasMessages Boolean @map("has_messages")
  incomingEmail String? @map("incoming_email") @unique
  membershipRequestTemplate String? @map("membership_request_template")
  mentionableLevel Int? @map("mentionable_level")
  messageableLevel Int? @map("messageable_level")
  name String @unique
  primaryGroup Boolean @map("primary_group")
  publicAdmission Boolean @map("public_admission")
  publicExit Boolean @map("public_exit")
  title String?
  updatedAt DateTime @map("updated_at")
  userCount Int @map("user_count")
  visibilityLevel Int @map("visibility_level")
  @@map("groups")
}

model GroupArchivedMessage {
  id Int @id
  createdAt DateTime? @map("created_at")
  groupId Int @map("group_id")
  topicId Int @map("topic_id")
  updatedAt DateTime? @map("updated_at")
  @@map("group_archived_messages")
}

model GroupCustomField {
  id Int @id
  createdAt DateTime @map("created_at")
  groupId Int @map("group_id")
  name String
  updatedAt DateTime @map("updated_at")
  value String?
  @@map("group_custom_fields")
}

model GroupHistory {
  id Int @id
  actingUserId Int @map("acting_user_id")
  action Int
  createdAt DateTime @map("created_at")
  groupId Int @map("group_id")
  newValue String? @map("new_value")
  prevValue String? @map("prev_value")
  subject String?
  targetUserId Int? @map("target_user_id")
  updatedAt DateTime @map("updated_at")
  @@map("group_histories")
}

model GroupMention {
  id Int @id
  createdAt DateTime? @map("created_at")
  groupId Int? @map("group_id")
  postId Int? @map("post_id")
  updatedAt DateTime? @map("updated_at")
  @@map("group_mentions")
}

model GroupUser {
  id Int @id
  createdAt DateTime @map("created_at")
  groupId Int @map("group_id")
  notificationLevel Int @map("notification_level")
  owner Boolean
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  @@map("group_users")
}

model IncomingDomain {
  id Int @id
  https Boolean
  name String
  port Int
  @@map("incoming_domains")
}

model IncomingEmail {
  id Int @id
  ccAddresses String? @map("cc_addresses")
  createdAt DateTime @map("created_at")
  error String?
  fromAddress String? @map("from_address")
  isAutoGenerated Boolean? @map("is_auto_generated")
  isBounce Boolean @map("is_bounce")
  messageId String? @map("message_id")
  postId Int? @map("post_id")
  raw String?
  rejectionMessage String? @map("rejection_message")
  subject String?
  toAddresses String? @map("to_addresses")
  topicId Int? @map("topic_id")
  updatedAt DateTime @map("updated_at")
  userId Int? @map("user_id")
  @@map("incoming_emails")
}

model IncomingLink {
  id Int @id
  createdAt DateTime @map("created_at")
  currentUserId Int? @map("current_user_id")
  incomingRefererId Int? @map("incoming_referer_id")
  postId Int @map("post_id")
  userId Int? @map("user_id")
  @@map("incoming_links")
}

model IncomingReferer {
  id Int @id
  incomingDomainId Int @map("incoming_domain_id")
  path String
  @@map("incoming_referrers")
}

model InstagramUserInfo {
  id Int @id
  createdAt DateTime @map("created_at")
  instagramUserId Int? @map("instagram_user_id")
  screenName String? @map("screen_name")
  updatedAt DateTime @map("updated_at")
  userId Int? @map("user_id")
  @@map("instagram_user_infos")
}

model Invite {
  id Int @id
  createdAt DateTime @map("created_at")
  customMessage String? @map("custom_message")
  deletedAt DateTime? @map("deleted_at")
  deletedById Int? @map("deleted_by_id")
  email String?
  invalidatedAt DateTime? @map("invalidated_at")
  invitedById Int @map("invited_by_id")
  inviteKey String @map("invite_key") @unique
  moderator Boolean
  redeemedAt DateTime? @map("redeemed_at")
  updatedAt DateTime @map("updated_at")
  userId Int? @map("user_id")
  @@map("invites")
}

model InvitedGroup {
  id Int @id
  createdAt DateTime @map("created_at")
  groupId Int? @map("group_id")
  inviteId Int? @map("invite_id")
  updatedAt DateTime @map("updated_at")
  @@map("invited_groups")
}

model JavascriptCache {
  id Int @id
  content String
  createdAt DateTime @map("created_at")
  digest String?
  themeFieldId Int @map("theme_field_id")
  updatedAt DateTime @map("updated_at")
  @@map("javascript_caches")
}

model MessageBus {
  id Int @id
  context String?
  createdAt DateTime @map("created_at")
  data String?
  name String?
  @@map("message_bus")
}

model MutedUser {
  id Int @id
  createdAt DateTime? @map("created_at")
  mutedUserId Int @map("muted_user_id")
  updatedAt DateTime? @map("updated_at")
  userId Int @map("user_id")
  @@map("muted_users")
}

model Notification {
  id Int @id
  createdAt DateTime @map("created_at")
  data String
  notificationType Int @map("notification_type")
  postActionId Int? @map("post_action_id")
  postNumber Int? @map("post_number")
  read Boolean
  topicId Int? @map("topic_id")
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  @@map("notifications")
}

model Oauth2UserInfo {
  id Int @id
  createdAt DateTime @map("created_at")
  email String?
  name String?
  provider String
  uid String
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  @@map("oauth2_user_infos")
}

model OnceoffLog {
  id Int @id
  createdAt DateTime @map("created_at")
  jobName String? @map("job_name")
  updatedAt DateTime @map("updated_at")
  @@map("onceoff_logs")
}

model OptimizedImage {
  id Int @id
  extension String
  filesize Int?
  height Int
  sha1 String
  uploadId Int @map("upload_id")
  url String
  width Int
  @@map("optimized_images")
}

model Permalink {
  id Int @id
  categoryId Int? @map("category_id")
  createdAt DateTime? @map("created_at")
  externalUrl String? @map("external_url")
  postId Int? @map("post_id")
  topicId Int? @map("topic_id")
  updatedAt DateTime? @map("updated_at")
  url String @unique
  @@map("permalinks")
}

model PluginStoreRow {
  id Int @id
  key String
  pluginName String @map("plugin_name")
  typeName String @map("type_name")
  value String?
  @@map("plugin_store_rows")
}

model Post {
  id Int @id
  actionCode String? @map("action_code")
  avgTime Int? @map("avg_time")
  bakedAt DateTime? @map("baked_at")
  bakedVersion Int? @map("baked_version")
  bookmarkCount Int @map("bookmark_count")
  cooked String
  cookMethod Int @map("cook_method")
  createdAt DateTime @map("created_at")
  deletedAt DateTime? @map("deleted_at")
  deletedById Int? @map("deleted_by_id")
  editReason String? @map("edit_reason")
  hidden Boolean
  hiddenAt DateTime? @map("hidden_at")
  hiddenReasonId Int? @map("hidden_reason_id")
  illegalCount Int @map("illegal_count")
  imageUrl String? @map("image_url")
  inappropriateCount Int @map("inappropriate_count")
  incomingLinkCount Int @map("incoming_link_count")
  lastEditorId Int? @map("last_editor_id")
  lastVersionAt DateTime @map("last_version_at")
  likeCount Int @map("like_count")
  likeScore Int @map("like_score")
  lockedById Int? @map("locked_by_id")
  notifyModeratorsCount Int @map("notify_moderators_count")
  notifyUserCount Int @map("notify_user_count")
  offTopicCount Int @map("off_topic_count")
  percentRank Float? @map("percent_rank")
  postNumber Int @map("post_number")
  postType Int @map("post_type")
  publicVersion Int @map("public_version")
  quoteCount Int @map("quote_count")
  raw String
  rawEmail String? @map("raw_email")
  reads Int
  replyCount Int @map("reply_count")
  replyQuoted Boolean @map("reply_quoted")
  replyToPostNumber Int? @map("reply_to_post_number")
  replyToUserId Int? @map("reply_to_user_id")
  score Float?
  selfEdits Int @map("self_edits")
  sortOrder Int? @map("sort_order")
  spamCount Int @map("spam_count")
  topicId Int @map("topic_id")
  updatedAt DateTime @map("updated_at")
  userDeleted Boolean @map("user_deleted")
  userId Int? @map("user_id")
  version Int
  viaEmail Boolean @map("via_email")
  wiki Boolean
  wordCount Int? @map("word_count")
  @@map("posts")
}

model PostAction {
  id Int @id
  agreedAt DateTime? @map("agreed_at")
  agreedById Int? @map("agreed_by_id")
  createdAt DateTime @map("created_at")
  deferredAt DateTime? @map("deferred_at")
  deferredById Int? @map("deferred_by_id")
  deletedAt DateTime? @map("deleted_at")
  deletedById Int? @map("deleted_by_id")
  disagreedAt DateTime? @map("disagreed_at")
  disagreedById Int? @map("disagreed_by_id")
  postActionTypeId Int @map("post_action_type_id")
  postId Int @map("post_id")
  relatedPostId Int? @map("related_post_id")
  staffTookAction Boolean @map("staff_took_action")
  targetsTopic Boolean @map("targets_topic")
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  @@map("post_actions")
}

model PostActionType {
  id Int @id
  createdAt DateTime @map("created_at")
  icon String?
  isFlag Boolean @map("is_flag")
  nameKey String @map("name_key")
  position Int
  updatedAt DateTime @map("updated_at")
  @@map("post_action_types")
}

model PostCustomField {
  id Int @id
  createdAt DateTime @map("created_at")
  name String
  postId Int @map("post_id")
  updatedAt DateTime @map("updated_at")
  value String?
  @@map("post_custom_fields")
}

model PostDetail {
  id Int @id
  createdAt DateTime @map("created_at")
  extra String?
  key String?
  postId Int? @map("post_id")
  updatedAt DateTime @map("updated_at")
  value String?
  @@map("post_details")
}

model PostReplyKey {
  id Int @id
  createdAt DateTime @map("created_at")
  postId Int @map("post_id")
  replyKey String @map("reply_key") @default(uuid()) @unique
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  @@map("post_reply_keys")
}

model PostRevision {
  id Int @id
  createdAt DateTime @map("created_at")
  hidden Boolean
  modifications String?
  number Int?
  postId Int? @map("post_id")
  updatedAt DateTime @map("updated_at")
  userId Int? @map("user_id")
  @@map("post_revisions")
}

model PostSearchDatum {
  post_id Int @id
  locale String?
  rawData String? @map("raw_data")
  version Int?
  @@map("post_search_data")
}

model PostStat {
  id Int @id
  composerOpenDurationMsecs Int? @map("composer_open_duration_msecs")
  createdAt DateTime? @map("created_at")
  draftsSaved Int? @map("drafts_saved")
  postId Int? @map("post_id")
  typingDurationMsecs Int? @map("typing_duration_msecs")
  updatedAt DateTime? @map("updated_at")
  @@map("post_stats")
}

model PostUpload {
  id Int @id
  postId Int @map("post_id")
  uploadId Int @map("upload_id")
  @@map("post_uploads")
}

model PushSubscription {
  id Int @id
  createdAt DateTime @map("created_at")
  data String
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  @@map("push_subscriptions")
}

model QueuedPost {
  id Int @id
  approvedAt DateTime? @map("approved_at")
  approvedById Int? @map("approved_by_id")
  createdAt DateTime? @map("created_at")
  queue String
  raw String
  rejectedAt DateTime? @map("rejected_at")
  rejectedById Int? @map("rejected_by_id")
  state Int
  topicId Int? @map("topic_id")
  updatedAt DateTime? @map("updated_at")
  userId Int @map("user_id")
  @@map("queued_posts")
}

model QuotedPost {
  id Int @id
  createdAt DateTime @map("created_at")
  postId Int @map("post_id")
  quotedPostId Int @map("quoted_post_id")
  updatedAt DateTime @map("updated_at")
  @@map("quoted_posts")
}

model RemoteTheme {
  id Int @id
  aboutUrl String? @map("about_url")
  branch String?
  commitsBehind Int? @map("commits_behind")
  createdAt DateTime? @map("created_at")
  lastErrorText String? @map("last_error_text")
  licenseUrl String? @map("license_url")
  localVersion String? @map("local_version")
  privateKey String? @map("private_key")
  remoteUpdatedAt DateTime? @map("remote_updated_at")
  remoteUrl String @map("remote_url")
  remoteVersion String? @map("remote_version")
  updatedAt DateTime? @map("updated_at")
  @@map("remote_themes")
}

model SchedulerStat {
  id Int @id
  durationMs Int? @map("duration_ms")
  error String?
  hostname String
  liveSlotsFinish Int? @map("live_slots_finish")
  liveSlotsStart Int? @map("live_slots_start")
  name String
  pid Int
  startedAt DateTime @map("started_at")
  success Boolean?
  @@map("scheduler_stats")
}

model SchemaMigration {
  version String @default(cuid()) @id @unique
  @@map("schema_migrations")
}

model SchemaMigrationDetail {
  id Int @id
  createdAt DateTime @map("created_at")
  direction String?
  duration Int?
  gitVersion String? @map("git_version")
  hostname String?
  name String?
  railsVersion String? @map("rails_version")
  version String
  @@map("schema_migration_details")
}

model ScreenedEmail {
  id Int @id
  actionType Int @map("action_type")
  createdAt DateTime @map("created_at")
  email String @unique
  lastMatchAt DateTime? @map("last_match_at")
  matchCount Int @map("match_count")
  updatedAt DateTime @map("updated_at")
  @@map("screened_emails")
}

model ScreenedIpAddress {
  id Int @id
  actionType Int @map("action_type")
  createdAt DateTime @map("created_at")
  lastMatchAt DateTime? @map("last_match_at")
  matchCount Int @map("match_count")
  updatedAt DateTime @map("updated_at")
  @@map("screened_ip_addresses")
}

model ScreenedUrl {
  id Int @id
  actionType Int @map("action_type")
  createdAt DateTime @map("created_at")
  domain String
  lastMatchAt DateTime? @map("last_match_at")
  matchCount Int @map("match_count")
  updatedAt DateTime @map("updated_at")
  url String @unique
  @@map("screened_urls")
}

model SearchLog {
  id Int @id
  createdAt DateTime @map("created_at")
  searchResultId Int? @map("search_result_id")
  searchResultType Int? @map("search_result_type")
  searchType Int @map("search_type")
  term String
  userId Int? @map("user_id")
  @@map("search_logs")
}

model SharedDraft {
  id Int @id
  categoryId Int @map("category_id")
  createdAt DateTime @map("created_at")
  topicId Int @map("topic_id") @unique
  updatedAt DateTime @map("updated_at")
  @@map("shared_drafts")
}

model SingleSignOnRecord {
  id Int @id
  createdAt DateTime @map("created_at")
  externalAvatarUrl String? @map("external_avatar_url")
  externalCardBackgroundUrl String? @map("external_card_background_url")
  externalEmail String? @map("external_email")
  externalId String @map("external_id") @unique
  externalName String? @map("external_name")
  externalProfileBackgroundUrl String? @map("external_profile_background_url")
  externalUsername String? @map("external_username")
  lastPayload String @map("last_payload")
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  @@map("single_sign_on_records")
}

model SiteSetting {
  id Int @id
  createdAt DateTime @map("created_at")
  dataType Int @map("data_type")
  name String
  updatedAt DateTime @map("updated_at")
  value String?
  @@map("site_settings")
}

model SkippedEmailLog {
  id Int @id
  createdAt DateTime @map("created_at")
  customReason String? @map("custom_reason")
  emailType String @map("email_type")
  postId Int? @map("post_id")
  reasonType Int @map("reason_type")
  toAddress String @map("to_address")
  updatedAt DateTime @map("updated_at")
  userId Int? @map("user_id")
  @@map("skipped_email_logs")
}

model StylesheetCache {
  id Int @id
  content String
  createdAt DateTime? @map("created_at")
  digest String
  sourceMap String? @map("source_map")
  target String
  themeId Int @map("theme_id")
  updatedAt DateTime? @map("updated_at")
  @@map("stylesheet_cache")
}

model Tag {
  id Int @id
  createdAt DateTime? @map("created_at")
  name String @unique
  pmTopicCount Int @map("pm_topic_count")
  topicCount Int @map("topic_count")
  updatedAt DateTime? @map("updated_at")
  @@map("tags")
}

model TagGroup {
  id Int @id
  createdAt DateTime? @map("created_at")
  name String
  onePerTopic Boolean? @map("one_per_topic")
  parentTagId Int? @map("parent_tag_id")
  updatedAt DateTime? @map("updated_at")
  @@map("tag_groups")
}

model TagGroupMembership {
  id Int @id
  createdAt DateTime? @map("created_at")
  tagGroupId Int @map("tag_group_id")
  tagId Int @map("tag_id")
  updatedAt DateTime? @map("updated_at")
  @@map("tag_group_memberships")
}

model TagGroupPermission {
  id Int @id
  createdAt DateTime @map("created_at")
  groupId Int @map("group_id")
  permissionType Int @map("permission_type")
  tagGroupId Int @map("tag_group_id")
  updatedAt DateTime @map("updated_at")
  @@map("tag_group_permissions")
}

model TagSearchDatum {
  tag_id Int @id
  locale String?
  rawData String? @map("raw_data")
  version Int?
  @@map("tag_search_data")
}

model TagUser {
  id Int @id
  createdAt DateTime? @map("created_at")
  notificationLevel Int @map("notification_level")
  tagId Int @map("tag_id")
  updatedAt DateTime? @map("updated_at")
  userId Int @map("user_id")
  @@map("tag_users")
}

model Theme {
  id Int @id
  colorSchemeId Int? @map("color_scheme_id")
  compilerVersion Int @map("compiler_version")
  component Boolean
  createdAt DateTime @map("created_at")
  hidden Boolean
  name String
  remoteThemeId Int? @map("remote_theme_id") @unique
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  userSelectable Boolean @map("user_selectable")
  @@map("themes")
}

model ThemeField {
  id Int @id
  compilerVersion Int @map("compiler_version")
  createdAt DateTime? @map("created_at")
  error String?
  name String
  targetId Int @map("target_id")
  themeId Int @map("theme_id")
  typeId Int @map("type_id")
  updatedAt DateTime? @map("updated_at")
  uploadId Int? @map("upload_id")
  value String
  valueBaked String? @map("value_baked")
  @@map("theme_fields")
}

model ThemeSetting {
  id Int @id
  createdAt DateTime @map("created_at")
  dataType Int @map("data_type")
  name String
  themeId Int @map("theme_id")
  updatedAt DateTime @map("updated_at")
  value String?
  @@map("theme_settings")
}

model TopTopic {
  id Int @id
  allScore Float? @map("all_score")
  dailyLikesCount Int @map("daily_likes_count")
  dailyOpLikesCount Int @map("daily_op_likes_count")
  dailyPostsCount Int @map("daily_posts_count")
  dailyScore Float? @map("daily_score")
  dailyViewsCount Int @map("daily_views_count")
  monthlyLikesCount Int @map("monthly_likes_count")
  monthlyOpLikesCount Int @map("monthly_op_likes_count")
  monthlyPostsCount Int @map("monthly_posts_count")
  monthlyScore Float? @map("monthly_score")
  monthlyViewsCount Int @map("monthly_views_count")
  quarterlyLikesCount Int @map("quarterly_likes_count")
  quarterlyOpLikesCount Int @map("quarterly_op_likes_count")
  quarterlyPostsCount Int @map("quarterly_posts_count")
  quarterlyScore Float? @map("quarterly_score")
  quarterlyViewsCount Int @map("quarterly_views_count")
  topicId Int? @map("topic_id") @unique
  weeklyLikesCount Int @map("weekly_likes_count")
  weeklyOpLikesCount Int @map("weekly_op_likes_count")
  weeklyPostsCount Int @map("weekly_posts_count")
  weeklyScore Float? @map("weekly_score")
  weeklyViewsCount Int @map("weekly_views_count")
  yearlyLikesCount Int @map("yearly_likes_count")
  yearlyOpLikesCount Int @map("yearly_op_likes_count")
  yearlyPostsCount Int @map("yearly_posts_count")
  yearlyScore Float? @map("yearly_score")
  yearlyViewsCount Int @map("yearly_views_count")
  @@map("top_topics")
}

model Topic {
  id Int @id
  archetype String
  archived Boolean
  avgTime Int? @map("avg_time")
  bumpedAt DateTime @map("bumped_at")
  categoryId Int? @map("category_id")
  closed Boolean
  createdAt DateTime @map("created_at")
  deletedAt DateTime? @map("deleted_at")
  deletedById Int? @map("deleted_by_id")
  excerpt String?
  fancyTitle String? @map("fancy_title")
  featuredLink String? @map("featured_link")
  featuredUser1Id Int? @map("featured_user1_id")
  featuredUser2Id Int? @map("featured_user2_id")
  featuredUser3Id Int? @map("featured_user3_id")
  featuredUser4Id Int? @map("featured_user4_id")
  hasSummary Boolean @map("has_summary")
  highestPostNumber Int @map("highest_post_number")
  highestStaffPostNumber Int @map("highest_staff_post_number")
  imageUrl String? @map("image_url")
  incomingLinkCount Int @map("incoming_link_count")
  lastPostedAt DateTime? @map("last_posted_at")
  lastPostUserId Int @map("last_post_user_id")
  likeCount Int @map("like_count")
  moderatorPostsCount Int @map("moderator_posts_count")
  notifyModeratorsCount Int @map("notify_moderators_count")
  participantCount Int? @map("participant_count")
  percentRank Float @map("percent_rank")
  pinnedAt DateTime? @map("pinned_at")
  pinnedGlobally Boolean @map("pinned_globally")
  pinnedUntil DateTime? @map("pinned_until")
  postsCount Int @map("posts_count")
  replyCount Int @map("reply_count")
  score Float?
  slug String?
  spamCount Int @map("spam_count")
  subtype String?
  title String
  updatedAt DateTime @map("updated_at")
  userId Int? @map("user_id")
  views Int
  visible Boolean
  wordCount Int? @map("word_count")
  @@map("topics")
}

model TopicAllowedGroup {
  id Int @id
  groupId Int @map("group_id")
  topicId Int @map("topic_id")
  @@map("topic_allowed_groups")
}

model TopicAllowedUser {
  id Int @id
  createdAt DateTime @map("created_at")
  topicId Int @map("topic_id")
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  @@map("topic_allowed_users")
}

model TopicCustomField {
  id Int @id
  createdAt DateTime @map("created_at")
  name String
  topicId Int @map("topic_id")
  updatedAt DateTime @map("updated_at")
  value String?
  @@map("topic_custom_fields")
}

model TopicEmbed {
  id Int @id
  contentSha1 String? @map("content_sha1")
  createdAt DateTime @map("created_at")
  deletedAt DateTime? @map("deleted_at")
  deletedById Int? @map("deleted_by_id")
  embedUrl String @map("embed_url") @unique
  postId Int @map("post_id")
  topicId Int @map("topic_id")
  updatedAt DateTime @map("updated_at")
  @@map("topic_embeds")
}

model TopicInvite {
  id Int @id
  createdAt DateTime @map("created_at")
  inviteId Int @map("invite_id")
  topicId Int @map("topic_id")
  updatedAt DateTime @map("updated_at")
  @@map("topic_invites")
}

model TopicLink {
  id Int @id
  clicks Int
  crawledAt DateTime? @map("crawled_at")
  createdAt DateTime @map("created_at")
  domain String
  extension String?
  internal Boolean
  linkPostId Int? @map("link_post_id")
  linkTopicId Int? @map("link_topic_id")
  postId Int? @map("post_id")
  quote Boolean
  reflection Boolean?
  title String?
  topicId Int @map("topic_id")
  updatedAt DateTime @map("updated_at")
  url String
  userId Int @map("user_id")
  @@map("topic_links")
}

model TopicLinkClick {
  id Int @id
  createdAt DateTime @map("created_at")
  topicLinkId Int @map("topic_link_id")
  updatedAt DateTime @map("updated_at")
  userId Int? @map("user_id")
  @@map("topic_link_clicks")
}

model TopicSearchDatum {
  topic_id Int @id
  locale String
  rawData String? @map("raw_data")
  version Int?
  @@map("topic_search_data")
}

model TopicTag {
  id Int @id
  createdAt DateTime? @map("created_at")
  tagId Int @map("tag_id")
  topicId Int @map("topic_id")
  updatedAt DateTime? @map("updated_at")
  @@map("topic_tags")
}

model TopicTimer {
  id Int @id
  basedOnLastPost Boolean @map("based_on_last_post")
  categoryId Int? @map("category_id")
  createdAt DateTime? @map("created_at")
  deletedAt DateTime? @map("deleted_at")
  deletedById Int? @map("deleted_by_id")
  executeAt DateTime @map("execute_at")
  publicType Boolean? @map("public_type")
  statusType Int @map("status_type")
  topicId Int @map("topic_id") @unique
  updatedAt DateTime? @map("updated_at")
  userId Int @map("user_id")
  @@map("topic_timers")
}

model TopicUser {
  id Int @id
  bookmarked Boolean?
  clearedPinnedAt DateTime? @map("cleared_pinned_at")
  firstVisitedAt DateTime? @map("first_visited_at")
  highestSeenPostNumber Int? @map("highest_seen_post_number")
  lastEmailedPostNumber Int? @map("last_emailed_post_number")
  lastReadPostNumber Int? @map("last_read_post_number")
  lastVisitedAt DateTime? @map("last_visited_at")
  liked Boolean?
  notificationLevel Int @map("notification_level")
  notificationsChangedAt DateTime? @map("notifications_changed_at")
  notificationsReasonId Int? @map("notifications_reason_id")
  posted Boolean
  topicId Int @map("topic_id")
  totalMsecsViewed Int @map("total_msecs_viewed")
  userId Int @map("user_id")
  @@map("topic_users")
}

model TranslationOverride {
  id Int @id
  compiledJs String? @map("compiled_js")
  createdAt DateTime @map("created_at")
  locale String
  translationKey String @map("translation_key")
  updatedAt DateTime @map("updated_at")
  value String
  @@map("translation_overrides")
}

model TwitterUserInfo {
  id Int @id
  createdAt DateTime @map("created_at")
  email String?
  screenName String @map("screen_name")
  twitterUserId Int @map("twitter_user_id") @unique
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id") @unique
  @@map("twitter_user_infos")
}

model UnsubscribeKey {
  key String @default(cuid()) @id
  createdAt DateTime? @map("created_at")
  postId Int? @map("post_id")
  topicId Int? @map("topic_id")
  unsubscribeKeyType String? @map("unsubscribe_key_type")
  updatedAt DateTime? @map("updated_at")
  userId Int @map("user_id")
  @@map("unsubscribe_keys")
}

model Upload {
  id Int @id
  createdAt DateTime @map("created_at")
  extension String?
  filesize Int
  height Int?
  origin String?
  originalFilename String @map("original_filename")
  retainHours Int? @map("retain_hours")
  sha1 String? @unique
  thumbnailHeight Int? @map("thumbnail_height")
  thumbnailWidth Int? @map("thumbnail_width")
  updatedAt DateTime @map("updated_at")
  url String
  userId Int @map("user_id")
  width Int?
  @@map("uploads")
}

model User {
  id Int @id
  active Boolean
  admin Boolean
  approved Boolean
  approvedAt DateTime? @map("approved_at")
  approvedById Int? @map("approved_by_id")
  createdAt DateTime @map("created_at")
  dateOfBirth DateTime? @map("date_of_birth")
  firstSeenAt DateTime? @map("first_seen_at")
  flagLevel Int @map("flag_level")
  groupLockedTrustLevel Int? @map("group_locked_trust_level")
  lastEmailedAt DateTime? @map("last_emailed_at")
  lastPostedAt DateTime? @map("last_posted_at")
  lastSeenAt DateTime? @map("last_seen_at")
  locale String?
  manualLockedTrustLevel Int? @map("manual_locked_trust_level")
  moderator Boolean?
  name String?
  passwordHash String? @map("password_hash")
  previousVisitAt DateTime? @map("previous_visit_at")
  primaryGroupId Int? @map("primary_group_id")
  salt String?
  seenNotificationId Int @map("seen_notification_id")
  silencedTill DateTime? @map("silenced_till")
  staged Boolean
  suspendedAt DateTime? @map("suspended_at")
  suspendedTill DateTime? @map("suspended_till")
  title String?
  trustLevel Int @map("trust_level")
  updatedAt DateTime @map("updated_at")
  uploadedAvatarId Int? @map("uploaded_avatar_id")
  username String @unique
  usernameLower String @map("username_lower") @unique
  views Int
  @@map("users")
}

model UserAction {
  id Int @id
  actingUserId Int? @map("acting_user_id")
  actionType Int @map("action_type")
  createdAt DateTime @map("created_at")
  queuedPostId Int? @map("queued_post_id")
  targetPostId Int? @map("target_post_id")
  targetTopicId Int? @map("target_topic_id")
  targetUserId Int? @map("target_user_id")
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  @@map("user_actions")
}

model UserApiKey {
  id Int @id
  applicationName String @map("application_name")
  clientId String @map("client_id") @unique
  createdAt DateTime? @map("created_at")
  key String @unique
  lastUsedAt DateTime @map("last_used_at")
  pushUrl String? @map("push_url")
  revokedAt DateTime? @map("revoked_at")
  scopes String
  updatedAt DateTime? @map("updated_at")
  userId Int @map("user_id")
  @@map("user_api_keys")
}

model UserArchivedMessage {
  id Int @id
  createdAt DateTime? @map("created_at")
  topicId Int @map("topic_id")
  updatedAt DateTime? @map("updated_at")
  userId Int @map("user_id")
  @@map("user_archived_messages")
}

model UserAuthToken {
  id Int @id
  authToken String @map("auth_token") @unique
  authTokenSeen Boolean @map("auth_token_seen")
  createdAt DateTime? @map("created_at")
  prevAuthToken String @map("prev_auth_token") @unique
  rotatedAt DateTime @map("rotated_at")
  seenAt DateTime? @map("seen_at")
  updatedAt DateTime? @map("updated_at")
  userAgent String? @map("user_agent")
  userId Int @map("user_id")
  @@map("user_auth_tokens")
}

model UserAuthTokenLog {
  id Int @id
  action String
  authToken String? @map("auth_token")
  createdAt DateTime? @map("created_at")
  path String?
  userAgent String? @map("user_agent")
  userAuthTokenId Int? @map("user_auth_token_id")
  userId Int? @map("user_id")
  @@map("user_auth_token_logs")
}

model UserAvatar {
  id Int @id
  createdAt DateTime @map("created_at")
  customUploadId Int? @map("custom_upload_id")
  gravatarUploadId Int? @map("gravatar_upload_id")
  lastGravatarDownloadAttempt DateTime? @map("last_gravatar_download_attempt")
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  @@map("user_avatars")
}

model UserBadge {
  id Int @id
  badgeId Int @map("badge_id")
  grantedAt DateTime @map("granted_at")
  grantedById Int @map("granted_by_id")
  notificationId Int? @map("notification_id")
  postId Int? @map("post_id")
  seq Int
  userId Int @map("user_id")
  @@map("user_badges")
}

model UserCustomField {
  id Int @id
  createdAt DateTime @map("created_at")
  name String
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  value String?
  @@map("user_custom_fields")
}

model UserEmail {
  id Int @id
  createdAt DateTime? @map("created_at")
  email String
  primary Boolean
  updatedAt DateTime? @map("updated_at")
  userId Int @map("user_id")
  @@map("user_emails")
}

model UserExport {
  id Int @id
  createdAt DateTime? @map("created_at")
  fileName String @map("file_name")
  updatedAt DateTime? @map("updated_at")
  uploadId Int? @map("upload_id")
  userId Int @map("user_id")
  @@map("user_exports")
}

model UserField {
  id Int @id
  createdAt DateTime? @map("created_at")
  description String
  editable Boolean
  externalName String? @map("external_name")
  externalType String? @map("external_type")
  fieldType String @map("field_type")
  name String
  position Int?
  required Boolean
  showOnProfile Boolean @map("show_on_profile")
  showOnUserCard Boolean @map("show_on_user_card")
  updatedAt DateTime? @map("updated_at")
  @@map("user_fields")
}

model UserFieldOption {
  id Int @id
  createdAt DateTime? @map("created_at")
  updatedAt DateTime? @map("updated_at")
  userFieldId Int @map("user_field_id")
  value String
  @@map("user_field_options")
}

model UserHistory {
  id Int @id
  actingUserId Int? @map("acting_user_id")
  action Int
  adminOnly Boolean? @map("admin_only")
  categoryId Int? @map("category_id")
  context String?
  createdAt DateTime @map("created_at")
  customType String? @map("custom_type")
  details String?
  email String?
  ipAddress String? @map("ip_address")
  newValue String? @map("new_value")
  postId Int? @map("post_id")
  previousValue String? @map("previous_value")
  subject String?
  targetUserId Int? @map("target_user_id")
  topicId Int? @map("topic_id")
  updatedAt DateTime @map("updated_at")
  @@map("user_histories")
}

model UserOpenId {
  id Int @id
  active Boolean
  createdAt DateTime @map("created_at")
  email String
  updatedAt DateTime @map("updated_at")
  url String
  userId Int @map("user_id")
  @@map("user_open_ids")
}

model UserOption {
  user_id Int @id @unique
  allowPrivateMessages Boolean @map("allow_private_messages")
  automaticallyUnpinTopics Boolean @map("automatically_unpin_topics")
  autoTrackTopicsAfterMsecs Int? @map("auto_track_topics_after_msecs")
  digestAfterMinutes Int? @map("digest_after_minutes")
  disableJumpReply Boolean @map("disable_jump_reply")
  dynamicFavicon Boolean @map("dynamic_favicon")
  emailAlways Boolean @map("email_always")
  emailDigests Boolean? @map("email_digests")
  emailDirect Boolean @map("email_direct")
  emailInReplyTo Boolean @map("email_in_reply_to")
  emailPreviousReplies Int @map("email_previous_replies")
  emailPrivateMessages Boolean @map("email_private_messages")
  enableQuoting Boolean @map("enable_quoting")
  externalLinksInNewTab Boolean @map("external_links_in_new_tab")
  hideProfileAndPresence Boolean @map("hide_profile_and_presence")
  homepageId Int? @map("homepage_id")
  includeTl0InDigests Boolean? @map("include_tl0_in_digests")
  lastRedirectedToTopAt DateTime? @map("last_redirected_to_top_at")
  likeNotificationFrequency Int @map("like_notification_frequency")
  mailingListMode Boolean @map("mailing_list_mode")
  mailingListModeFrequency Int @map("mailing_list_mode_frequency")
  newTopicDurationMinutes Int? @map("new_topic_duration_minutes")
  notificationLevelWhenReplying Int? @map("notification_level_when_replying")
  themeIds Int @map("theme_ids")
  themeKeySeq Int @map("theme_key_seq")
  @@map("user_options")
}

model UserProfile {
  user_id Int @id
  badgeGrantedTitle Boolean? @map("badge_granted_title")
  bioCooked String? @map("bio_cooked")
  bioCookedVersion Int? @map("bio_cooked_version")
  bioRaw String? @map("bio_raw")
  cardBackground String? @map("card_background")
  dismissedBannerKey Int? @map("dismissed_banner_key")
  location String?
  profileBackground String? @map("profile_background")
  views Int
  website String?
  @@map("user_profiles")
}

model UserProfileView {
  id Int @id
  userId Int? @map("user_id")
  userProfileId Int @map("user_profile_id")
  viewedAt DateTime @map("viewed_at")
  @@map("user_profile_views")
}

model UserSearchDatum {
  user_id Int @id
  locale String?
  rawData String? @map("raw_data")
  version Int?
  @@map("user_search_data")
}

model UserSecondFactor {
  id Int @id
  createdAt DateTime @map("created_at")
  data String
  enabled Boolean
  lastUsed DateTime? @map("last_used")
  method Int
  updatedAt DateTime @map("updated_at")
  userId Int @map("user_id")
  @@map("user_second_factors")
}

model UserStat {
  user_id Int @id
  bounceScore Float @map("bounce_score")
  daysVisited Int @map("days_visited")
  firstPostCreatedAt DateTime? @map("first_post_created_at")
  likesGiven Int @map("likes_given")
  likesReceived Int @map("likes_received")
  newSince DateTime @map("new_since")
  postCount Int @map("post_count")
  postsReadCount Int @map("posts_read_count")
  readFaq DateTime? @map("read_faq")
  resetBounceScoreAfter DateTime? @map("reset_bounce_score_after")
  timeRead Int @map("time_read")
  topicCount Int @map("topic_count")
  topicReplyCount Int @map("topic_reply_count")
  topicsEntered Int @map("topics_entered")
  @@map("user_stats")
}

model UserUpload {
  id Int @id
  createdAt DateTime @map("created_at")
  uploadId Int @map("upload_id")
  userId Int @map("user_id")
  @@map("user_uploads")
}

model UserVisit {
  id Int @id
  mobile Boolean?
  postsRead Int? @map("posts_read")
  timeRead Int @map("time_read")
  userId Int @map("user_id")
  visitedAt DateTime @map("visited_at")
  @@map("user_visits")
}

model UserWarning {
  id Int @id
  createdAt DateTime? @map("created_at")
  createdById Int @map("created_by_id")
  topicId Int @map("topic_id") @unique
  updatedAt DateTime? @map("updated_at")
  userId Int @map("user_id")
  @@map("user_warnings")
}

model WatchedWord {
  id Int @id
  action Int
  createdAt DateTime? @map("created_at")
  updatedAt DateTime? @map("updated_at")
  word String
  @@map("watched_words")
}

model WebCrawlerRequest {
  id Int @id
  count Int
  date DateTime
  userAgent String @map("user_agent")
  @@map("web_crawler_requests")
}

model WebHook {
  id Int @id
  active Boolean
  contentType Int @map("content_type")
  createdAt DateTime? @map("created_at")
  lastDeliveryStatus Int @map("last_delivery_status")
  payloadUrl String @map("payload_url")
  secret String?
  status Int
  updatedAt DateTime? @map("updated_at")
  verifyCertificate Boolean @map("verify_certificate")
  wildcardWebHook Boolean @map("wildcard_web_hook")
  @@map("web_hooks")
}

model WebHookEvent {
  id Int @id
  createdAt DateTime? @map("created_at")
  duration Int?
  headers String?
  payload String?
  responseBody String? @map("response_body")
  responseHeaders String? @map("response_headers")
  status Int?
  updatedAt DateTime? @map("updated_at")
  webHookId Int @map("web_hook_id")
  @@map("web_hook_events")
}

model WebHookEventType {
  id Int @id
  name String
  @@map("web_hook_event_types")
}`
