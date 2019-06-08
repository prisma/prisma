export const discourse = `model ApiKey {
  id Int @id
  createdAt DateTime @db("created_at")
  createdById Int? @db("created_by_id")
  hidden Boolean
  key String
  updatedAt DateTime @db("updated_at")
  userId Int? @db("user_id") @unique
  @@db("api_keys")
}

model ApplicationRequest {
  id Int @id
  count Int
  date DateTime
  reqType Int @db("req_type")
  @@db("application_requests")
}

model ArInternalMetadatum {
  key String @default(cuid()) @id
  createdAt DateTime @db("created_at")
  updatedAt DateTime @db("updated_at")
  value String?
  @@db("ar_internal_metadata")
}

model Badge {
  id Int @id
  allowTitle Boolean @db("allow_title")
  autoRevoke Boolean @db("auto_revoke")
  badgeGroupingId Int @db("badge_grouping_id")
  badgeTypeId Int @db("badge_type_id")
  createdAt DateTime @db("created_at")
  description String?
  enabled Boolean
  grantCount Int @db("grant_count")
  icon String?
  image String?
  listable Boolean?
  longDescription String? @db("long_description")
  multipleGrant Boolean @db("multiple_grant")
  name String @unique
  query String?
  showPosts Boolean @db("show_posts")
  system Boolean
  targetPosts Boolean? @db("target_posts")
  trigger Int?
  updatedAt DateTime @db("updated_at")
  @@db("badges")
}

model BadgeGrouping {
  id Int @id
  createdAt DateTime @db("created_at")
  description String?
  name String
  position Int
  updatedAt DateTime @db("updated_at")
  @@db("badge_groupings")
}

model BadgeType {
  id Int @id
  createdAt DateTime @db("created_at")
  name String @unique
  updatedAt DateTime @db("updated_at")
  @@db("badge_types")
}

model Category {
  id Int @id
  allowBadges Boolean @db("allow_badges")
  allTopicsWiki Boolean @db("all_topics_wiki")
  autoCloseBasedOnLastPost Boolean? @db("auto_close_based_on_last_post")
  autoCloseHours Float? @db("auto_close_hours")
  color String
  containsMessages Boolean? @db("contains_messages")
  createdAt DateTime @db("created_at")
  defaultTopPeriod String? @db("default_top_period")
  defaultView String? @db("default_view")
  description String?
  emailIn String? @db("email_in") @unique
  emailInAllowStrangers Boolean? @db("email_in_allow_strangers")
  latestPostId Int? @db("latest_post_id")
  latestTopicId Int? @db("latest_topic_id")
  mailinglistMirror Boolean @db("mailinglist_mirror")
  minimumRequiredTags Int? @db("minimum_required_tags")
  name String @unique
  nameLower String @db("name_lower")
  navigateToFirstPostAfterRead Boolean @db("navigate_to_first_post_after_read")
  numFeaturedTopics Int? @db("num_featured_topics")
  parentCategoryId Int? @db("parent_category_id")
  position Int?
  postCount Int @db("post_count")
  postsDay Int? @db("posts_day")
  postsMonth Int? @db("posts_month")
  postsWeek Int? @db("posts_week")
  postsYear Int? @db("posts_year")
  readRestricted Boolean @db("read_restricted")
  showSubcategoryList Boolean? @db("show_subcategory_list")
  slug String
  sortAscending Boolean? @db("sort_ascending")
  sortOrder String? @db("sort_order")
  subcategoryListStyle String? @db("subcategory_list_style")
  suppressFromLatest Boolean? @db("suppress_from_latest")
  textColor String @db("text_color")
  topicCount Int @db("topic_count")
  topicFeaturedLinkAllowed Boolean? @db("topic_featured_link_allowed")
  topicId Int? @db("topic_id")
  topicsDay Int? @db("topics_day")
  topicsMonth Int? @db("topics_month")
  topicsWeek Int? @db("topics_week")
  topicsYear Int? @db("topics_year")
  topicTemplate String? @db("topic_template")
  updatedAt DateTime @db("updated_at")
  uploadedBackgroundId Int? @db("uploaded_background_id")
  uploadedLogoId Int? @db("uploaded_logo_id")
  userId Int @db("user_id")
  @@db("categories")
}

model CategoryCustomField {
  id Int @id
  categoryId Int @db("category_id")
  createdAt DateTime @db("created_at")
  name String
  updatedAt DateTime @db("updated_at")
  value String?
  @@db("category_custom_fields")
}

model CategoryFeaturedTopic {
  id Int @id
  categoryId Int @db("category_id")
  createdAt DateTime @db("created_at")
  rank Int
  topicId Int @db("topic_id")
  updatedAt DateTime @db("updated_at")
  @@db("category_featured_topics")
}

model CategoryGroup {
  id Int @id
  categoryId Int @db("category_id")
  createdAt DateTime @db("created_at")
  groupId Int @db("group_id")
  permissionType Int? @db("permission_type")
  updatedAt DateTime @db("updated_at")
  @@db("category_groups")
}

model CategorySearchDatum {
  category_id Int @id
  locale String?
  rawData String? @db("raw_data")
  version Int?
  @@db("category_search_data")
}

model CategoryTag {
  id Int @id
  categoryId Int @db("category_id")
  createdAt DateTime? @db("created_at")
  tagId Int @db("tag_id")
  updatedAt DateTime? @db("updated_at")
  @@db("category_tags")
}

model CategoryTagGroup {
  id Int @id
  categoryId Int @db("category_id")
  createdAt DateTime? @db("created_at")
  tagGroupId Int @db("tag_group_id")
  updatedAt DateTime? @db("updated_at")
  @@db("category_tag_groups")
}

model CategoryTagStat {
  id Int @id
  categoryId Int @db("category_id")
  tagId Int @db("tag_id")
  topicCount Int @db("topic_count")
  @@db("category_tag_stats")
}

model CategoryUser {
  id Int @id
  categoryId Int @db("category_id")
  notificationLevel Int @db("notification_level")
  userId Int @db("user_id")
  @@db("category_users")
}

model ChildTheme {
  id Int @id
  childThemeId Int? @db("child_theme_id")
  createdAt DateTime? @db("created_at")
  parentThemeId Int? @db("parent_theme_id")
  updatedAt DateTime? @db("updated_at")
  @@db("child_themes")
}

model ColorScheme {
  id Int @id
  baseSchemeId String? @db("base_scheme_id")
  createdAt DateTime @db("created_at")
  name String
  themeId Int? @db("theme_id")
  updatedAt DateTime @db("updated_at")
  version Int
  viaWizard Boolean @db("via_wizard")
  @@db("color_schemes")
}

model ColorSchemeColor {
  id Int @id
  colorSchemeId Int @db("color_scheme_id")
  createdAt DateTime @db("created_at")
  hex String
  name String
  updatedAt DateTime @db("updated_at")
  @@db("color_scheme_colors")
}

model CustomEmoji {
  id Int @id
  createdAt DateTime @db("created_at")
  name String @unique
  updatedAt DateTime @db("updated_at")
  uploadId Int @db("upload_id")
  @@db("custom_emojis")
}

model Developer {
  id Int @id
  userId Int @db("user_id")
  @@db("developers")
}

model DirectoryItem {
  id Int @id
  createdAt DateTime? @db("created_at")
  daysVisited Int @db("days_visited")
  likesGiven Int @db("likes_given")
  likesReceived Int @db("likes_received")
  periodType Int @db("period_type")
  postCount Int @db("post_count")
  postsRead Int @db("posts_read")
  topicCount Int @db("topic_count")
  topicsEntered Int @db("topics_entered")
  updatedAt DateTime? @db("updated_at")
  userId Int @db("user_id")
  @@db("directory_items")
}

model Draft {
  id Int @id
  createdAt DateTime @db("created_at")
  data String
  draftKey String @db("draft_key")
  revisions Int
  sequence Int
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  @@db("drafts")
}

model DraftSequence {
  id Int @id
  draftKey String @db("draft_key")
  sequence Int
  userId Int @db("user_id")
  @@db("draft_sequences")
}

model EmailChangeRequest {
  id Int @id
  changeState Int @db("change_state")
  createdAt DateTime @db("created_at")
  newEmail String @db("new_email")
  newEmailTokenId Int? @db("new_email_token_id")
  oldEmail String @db("old_email")
  oldEmailTokenId Int? @db("old_email_token_id")
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  @@db("email_change_requests")
}

model EmailLog {
  id Int @id
  bounced Boolean
  bounceKey String? @db("bounce_key") @default(uuid())
  createdAt DateTime @db("created_at")
  emailType String @db("email_type")
  messageId String? @db("message_id")
  postId Int? @db("post_id")
  toAddress String @db("to_address")
  updatedAt DateTime @db("updated_at")
  userId Int? @db("user_id")
  @@db("email_logs")
}

model EmailToken {
  id Int @id
  confirmed Boolean
  createdAt DateTime @db("created_at")
  email String
  expired Boolean
  token String @unique
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  @@db("email_tokens")
}

model EmbeddableHost {
  id Int @id
  categoryId Int @db("category_id")
  className String? @db("class_name")
  createdAt DateTime? @db("created_at")
  host String
  pathWhitelist String? @db("path_whitelist")
  updatedAt DateTime? @db("updated_at")
  @@db("embeddable_hosts")
}

model FacebookUserInfo {
  id Int @id
  aboutMe String? @db("about_me")
  avatarUrl String? @db("avatar_url")
  createdAt DateTime @db("created_at")
  email String?
  facebookUserId Int @db("facebook_user_id") @unique
  firstName String? @db("first_name")
  gender String?
  lastName String? @db("last_name")
  link String?
  location String?
  name String?
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id") @unique
  username String?
  website String?
  @@db("facebook_user_infos")
}

model GithubUserInfo {
  id Int @id
  createdAt DateTime @db("created_at")
  githubUserId Int @db("github_user_id") @unique
  screenName String @db("screen_name")
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id") @unique
  @@db("github_user_infos")
}

model GoogleUserInfo {
  id Int @id
  createdAt DateTime @db("created_at")
  email String?
  firstName String? @db("first_name")
  gender String?
  googleUserId String @db("google_user_id") @unique
  lastName String? @db("last_name")
  link String?
  name String?
  picture String?
  profileLink String? @db("profile_link")
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id") @unique
  @@db("google_user_infos")
}

model Group {
  id Int @id
  allowMembershipRequests Boolean @db("allow_membership_requests")
  automatic Boolean
  automaticMembershipEmailDomains String? @db("automatic_membership_email_domains")
  automaticMembershipRetroactive Boolean? @db("automatic_membership_retroactive")
  bioCooked String? @db("bio_cooked")
  bioRaw String? @db("bio_raw")
  createdAt DateTime @db("created_at")
  defaultNotificationLevel Int @db("default_notification_level")
  flairBgColor String? @db("flair_bg_color")
  flairColor String? @db("flair_color")
  flairUrl String? @db("flair_url")
  fullName String? @db("full_name")
  grantTrustLevel Int? @db("grant_trust_level")
  hasMessages Boolean @db("has_messages")
  incomingEmail String? @db("incoming_email") @unique
  membershipRequestTemplate String? @db("membership_request_template")
  mentionableLevel Int? @db("mentionable_level")
  messageableLevel Int? @db("messageable_level")
  name String @unique
  primaryGroup Boolean @db("primary_group")
  publicAdmission Boolean @db("public_admission")
  publicExit Boolean @db("public_exit")
  title String?
  updatedAt DateTime @db("updated_at")
  userCount Int @db("user_count")
  visibilityLevel Int @db("visibility_level")
  @@db("groups")
}

model GroupArchivedMessage {
  id Int @id
  createdAt DateTime? @db("created_at")
  groupId Int @db("group_id")
  topicId Int @db("topic_id")
  updatedAt DateTime? @db("updated_at")
  @@db("group_archived_messages")
}

model GroupCustomField {
  id Int @id
  createdAt DateTime @db("created_at")
  groupId Int @db("group_id")
  name String
  updatedAt DateTime @db("updated_at")
  value String?
  @@db("group_custom_fields")
}

model GroupHistory {
  id Int @id
  actingUserId Int @db("acting_user_id")
  action Int
  createdAt DateTime @db("created_at")
  groupId Int @db("group_id")
  newValue String? @db("new_value")
  prevValue String? @db("prev_value")
  subject String?
  targetUserId Int? @db("target_user_id")
  updatedAt DateTime @db("updated_at")
  @@db("group_histories")
}

model GroupMention {
  id Int @id
  createdAt DateTime? @db("created_at")
  groupId Int? @db("group_id")
  postId Int? @db("post_id")
  updatedAt DateTime? @db("updated_at")
  @@db("group_mentions")
}

model GroupUser {
  id Int @id
  createdAt DateTime @db("created_at")
  groupId Int @db("group_id")
  notificationLevel Int @db("notification_level")
  owner Boolean
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  @@db("group_users")
}

model IncomingDomain {
  id Int @id
  https Boolean
  name String
  port Int
  @@db("incoming_domains")
}

model IncomingEmail {
  id Int @id
  ccAddresses String? @db("cc_addresses")
  createdAt DateTime @db("created_at")
  error String?
  fromAddress String? @db("from_address")
  isAutoGenerated Boolean? @db("is_auto_generated")
  isBounce Boolean @db("is_bounce")
  messageId String? @db("message_id")
  postId Int? @db("post_id")
  raw String?
  rejectionMessage String? @db("rejection_message")
  subject String?
  toAddresses String? @db("to_addresses")
  topicId Int? @db("topic_id")
  updatedAt DateTime @db("updated_at")
  userId Int? @db("user_id")
  @@db("incoming_emails")
}

model IncomingLink {
  id Int @id
  createdAt DateTime @db("created_at")
  currentUserId Int? @db("current_user_id")
  incomingRefererId Int? @db("incoming_referer_id")
  postId Int @db("post_id")
  userId Int? @db("user_id")
  @@db("incoming_links")
}

model IncomingReferer {
  id Int @id
  incomingDomainId Int @db("incoming_domain_id")
  path String
  @@db("incoming_referers")
}

model InstagramUserInfo {
  id Int @id
  createdAt DateTime @db("created_at")
  instagramUserId Int? @db("instagram_user_id")
  screenName String? @db("screen_name")
  updatedAt DateTime @db("updated_at")
  userId Int? @db("user_id")
  @@db("instagram_user_infos")
}

model Invite {
  id Int @id
  createdAt DateTime @db("created_at")
  customMessage String? @db("custom_message")
  deletedAt DateTime? @db("deleted_at")
  deletedById Int? @db("deleted_by_id")
  email String?
  invalidatedAt DateTime? @db("invalidated_at")
  invitedById Int @db("invited_by_id")
  inviteKey String @db("invite_key") @unique
  moderator Boolean
  redeemedAt DateTime? @db("redeemed_at")
  updatedAt DateTime @db("updated_at")
  userId Int? @db("user_id")
  @@db("invites")
}

model InvitedGroup {
  id Int @id
  createdAt DateTime @db("created_at")
  groupId Int? @db("group_id")
  inviteId Int? @db("invite_id")
  updatedAt DateTime @db("updated_at")
  @@db("invited_groups")
}

model JavascriptCach {
  id Int @id
  content String
  createdAt DateTime @db("created_at")
  digest String?
  themeFieldId Int @db("theme_field_id")
  updatedAt DateTime @db("updated_at")
  @@db("javascript_caches")
}

model MessageBus {
  id Int @id
  context String?
  createdAt DateTime @db("created_at")
  data String?
  name String?
  @@db("message_bus")
}

model MutedUser {
  id Int @id
  createdAt DateTime? @db("created_at")
  mutedUserId Int @db("muted_user_id")
  updatedAt DateTime? @db("updated_at")
  userId Int @db("user_id")
  @@db("muted_users")
}

model Notification {
  id Int @id
  createdAt DateTime @db("created_at")
  data String
  notificationType Int @db("notification_type")
  postActionId Int? @db("post_action_id")
  postNumber Int? @db("post_number")
  read Boolean
  topicId Int? @db("topic_id")
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  @@db("notifications")
}

model Oauth2UserInfo {
  id Int @id
  createdAt DateTime @db("created_at")
  email String?
  name String?
  provider String
  uid String
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  @@db("oauth2_user_infos")
}

model OnceoffLog {
  id Int @id
  createdAt DateTime @db("created_at")
  jobName String? @db("job_name")
  updatedAt DateTime @db("updated_at")
  @@db("onceoff_logs")
}

model OptimizedImage {
  id Int @id
  extension String
  filesize Int?
  height Int
  sha1 String
  uploadId Int @db("upload_id")
  url String
  width Int
  @@db("optimized_images")
}

model Permalink {
  id Int @id
  categoryId Int? @db("category_id")
  createdAt DateTime? @db("created_at")
  externalUrl String? @db("external_url")
  postId Int? @db("post_id")
  topicId Int? @db("topic_id")
  updatedAt DateTime? @db("updated_at")
  url String @unique
  @@db("permalinks")
}

model PluginStoreRow {
  id Int @id
  key String
  pluginName String @db("plugin_name")
  typeName String @db("type_name")
  value String?
  @@db("plugin_store_rows")
}

model Post {
  id Int @id
  actionCode String? @db("action_code")
  avgTime Int? @db("avg_time")
  bakedAt DateTime? @db("baked_at")
  bakedVersion Int? @db("baked_version")
  bookmarkCount Int @db("bookmark_count")
  cooked String
  cookMethod Int @db("cook_method")
  createdAt DateTime @db("created_at")
  deletedAt DateTime? @db("deleted_at")
  deletedById Int? @db("deleted_by_id")
  editReason String? @db("edit_reason")
  hidden Boolean
  hiddenAt DateTime? @db("hidden_at")
  hiddenReasonId Int? @db("hidden_reason_id")
  illegalCount Int @db("illegal_count")
  imageUrl String? @db("image_url")
  inappropriateCount Int @db("inappropriate_count")
  incomingLinkCount Int @db("incoming_link_count")
  lastEditorId Int? @db("last_editor_id")
  lastVersionAt DateTime @db("last_version_at")
  likeCount Int @db("like_count")
  likeScore Int @db("like_score")
  lockedById Int? @db("locked_by_id")
  notifyModeratorsCount Int @db("notify_moderators_count")
  notifyUserCount Int @db("notify_user_count")
  offTopicCount Int @db("off_topic_count")
  percentRank Float? @db("percent_rank")
  postNumber Int @db("post_number")
  postType Int @db("post_type")
  publicVersion Int @db("public_version")
  quoteCount Int @db("quote_count")
  raw String
  rawEmail String? @db("raw_email")
  reads Int
  replyCount Int @db("reply_count")
  replyQuoted Boolean @db("reply_quoted")
  replyToPostNumber Int? @db("reply_to_post_number")
  replyToUserId Int? @db("reply_to_user_id")
  score Float?
  selfEdits Int @db("self_edits")
  sortOrder Int? @db("sort_order")
  spamCount Int @db("spam_count")
  topicId Int @db("topic_id")
  updatedAt DateTime @db("updated_at")
  userDeleted Boolean @db("user_deleted")
  userId Int? @db("user_id")
  version Int
  viaEmail Boolean @db("via_email")
  wiki Boolean
  wordCount Int? @db("word_count")
  @@db("posts")
}

model PostAction {
  id Int @id
  agreedAt DateTime? @db("agreed_at")
  agreedById Int? @db("agreed_by_id")
  createdAt DateTime @db("created_at")
  deferredAt DateTime? @db("deferred_at")
  deferredById Int? @db("deferred_by_id")
  deletedAt DateTime? @db("deleted_at")
  deletedById Int? @db("deleted_by_id")
  disagreedAt DateTime? @db("disagreed_at")
  disagreedById Int? @db("disagreed_by_id")
  postActionTypeId Int @db("post_action_type_id")
  postId Int @db("post_id")
  relatedPostId Int? @db("related_post_id")
  staffTookAction Boolean @db("staff_took_action")
  targetsTopic Boolean @db("targets_topic")
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  @@db("post_actions")
}

model PostActionType {
  id Int @id
  createdAt DateTime @db("created_at")
  icon String?
  isFlag Boolean @db("is_flag")
  nameKey String @db("name_key")
  position Int
  updatedAt DateTime @db("updated_at")
  @@db("post_action_types")
}

model PostCustomField {
  id Int @id
  createdAt DateTime @db("created_at")
  name String
  postId Int @db("post_id")
  updatedAt DateTime @db("updated_at")
  value String?
  @@db("post_custom_fields")
}

model PostDetail {
  id Int @id
  createdAt DateTime @db("created_at")
  extra String?
  key String?
  postId Int? @db("post_id")
  updatedAt DateTime @db("updated_at")
  value String?
  @@db("post_details")
}

model PostReplyKey {
  id Int @id
  createdAt DateTime @db("created_at")
  postId Int @db("post_id")
  replyKey String @db("reply_key") @default(uuid()) @unique
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  @@db("post_reply_keys")
}

model PostRevision {
  id Int @id
  createdAt DateTime @db("created_at")
  hidden Boolean
  modifications String?
  number Int?
  postId Int? @db("post_id")
  updatedAt DateTime @db("updated_at")
  userId Int? @db("user_id")
  @@db("post_revisions")
}

model PostSearchDatum {
  post_id Int @id
  locale String?
  rawData String? @db("raw_data")
  version Int?
  @@db("post_search_data")
}

model PostStat {
  id Int @id
  composerOpenDurationMsecs Int? @db("composer_open_duration_msecs")
  createdAt DateTime? @db("created_at")
  draftsSaved Int? @db("drafts_saved")
  postId Int? @db("post_id")
  typingDurationMsecs Int? @db("typing_duration_msecs")
  updatedAt DateTime? @db("updated_at")
  @@db("post_stats")
}

model PostUpload {
  id Int @id
  postId Int @db("post_id")
  uploadId Int @db("upload_id")
  @@db("post_uploads")
}

model PushSubscription {
  id Int @id
  createdAt DateTime @db("created_at")
  data String
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  @@db("push_subscriptions")
}

model QueuedPost {
  id Int @id
  approvedAt DateTime? @db("approved_at")
  approvedById Int? @db("approved_by_id")
  createdAt DateTime? @db("created_at")
  queue String
  raw String
  rejectedAt DateTime? @db("rejected_at")
  rejectedById Int? @db("rejected_by_id")
  state Int
  topicId Int? @db("topic_id")
  updatedAt DateTime? @db("updated_at")
  userId Int @db("user_id")
  @@db("queued_posts")
}

model QuotedPost {
  id Int @id
  createdAt DateTime @db("created_at")
  postId Int @db("post_id")
  quotedPostId Int @db("quoted_post_id")
  updatedAt DateTime @db("updated_at")
  @@db("quoted_posts")
}

model RemoteTheme {
  id Int @id
  aboutUrl String? @db("about_url")
  branch String?
  commitsBehind Int? @db("commits_behind")
  createdAt DateTime? @db("created_at")
  lastErrorText String? @db("last_error_text")
  licenseUrl String? @db("license_url")
  localVersion String? @db("local_version")
  privateKey String? @db("private_key")
  remoteUpdatedAt DateTime? @db("remote_updated_at")
  remoteUrl String @db("remote_url")
  remoteVersion String? @db("remote_version")
  updatedAt DateTime? @db("updated_at")
  @@db("remote_themes")
}

model SchedulerStat {
  id Int @id
  durationMs Int? @db("duration_ms")
  error String?
  hostname String
  liveSlotsFinish Int? @db("live_slots_finish")
  liveSlotsStart Int? @db("live_slots_start")
  name String
  pid Int
  startedAt DateTime @db("started_at")
  success Boolean?
  @@db("scheduler_stats")
}

model SchemaMigration {
  version String @default(cuid()) @id @unique
  @@db("schema_migrations")
}

model SchemaMigrationDetail {
  id Int @id
  createdAt DateTime @db("created_at")
  direction String?
  duration Int?
  gitVersion String? @db("git_version")
  hostname String?
  name String?
  railsVersion String? @db("rails_version")
  version String
  @@db("schema_migration_details")
}

model ScreenedEmail {
  id Int @id
  actionType Int @db("action_type")
  createdAt DateTime @db("created_at")
  email String @unique
  lastMatchAt DateTime? @db("last_match_at")
  matchCount Int @db("match_count")
  updatedAt DateTime @db("updated_at")
  @@db("screened_emails")
}

model ScreenedIpAddress {
  id Int @id
  actionType Int @db("action_type")
  createdAt DateTime @db("created_at")
  lastMatchAt DateTime? @db("last_match_at")
  matchCount Int @db("match_count")
  updatedAt DateTime @db("updated_at")
  @@db("screened_ip_addresses")
}

model ScreenedUrl {
  id Int @id
  actionType Int @db("action_type")
  createdAt DateTime @db("created_at")
  domain String
  lastMatchAt DateTime? @db("last_match_at")
  matchCount Int @db("match_count")
  updatedAt DateTime @db("updated_at")
  url String @unique
  @@db("screened_urls")
}

model SearchLog {
  id Int @id
  createdAt DateTime @db("created_at")
  searchResultId Int? @db("search_result_id")
  searchResultType Int? @db("search_result_type")
  searchType Int @db("search_type")
  term String
  userId Int? @db("user_id")
  @@db("search_logs")
}

model SharedDraft {
  id Int @id
  categoryId Int @db("category_id")
  createdAt DateTime @db("created_at")
  topicId Int @db("topic_id") @unique
  updatedAt DateTime @db("updated_at")
  @@db("shared_drafts")
}

model SingleSignOnRecord {
  id Int @id
  createdAt DateTime @db("created_at")
  externalAvatarUrl String? @db("external_avatar_url")
  externalCardBackgroundUrl String? @db("external_card_background_url")
  externalEmail String? @db("external_email")
  externalId String @db("external_id") @unique
  externalName String? @db("external_name")
  externalProfileBackgroundUrl String? @db("external_profile_background_url")
  externalUsername String? @db("external_username")
  lastPayload String @db("last_payload")
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  @@db("single_sign_on_records")
}

model SiteSetting {
  id Int @id
  createdAt DateTime @db("created_at")
  dataType Int @db("data_type")
  name String
  updatedAt DateTime @db("updated_at")
  value String?
  @@db("site_settings")
}

model SkippedEmailLog {
  id Int @id
  createdAt DateTime @db("created_at")
  customReason String? @db("custom_reason")
  emailType String @db("email_type")
  postId Int? @db("post_id")
  reasonType Int @db("reason_type")
  toAddress String @db("to_address")
  updatedAt DateTime @db("updated_at")
  userId Int? @db("user_id")
  @@db("skipped_email_logs")
}

model StylesheetCache {
  id Int @id
  content String
  createdAt DateTime? @db("created_at")
  digest String
  sourceMap String? @db("source_map")
  target String
  themeId Int @db("theme_id")
  updatedAt DateTime? @db("updated_at")
  @@db("stylesheet_cache")
}

model Tag {
  id Int @id
  createdAt DateTime? @db("created_at")
  name String @unique
  pmTopicCount Int @db("pm_topic_count")
  topicCount Int @db("topic_count")
  updatedAt DateTime? @db("updated_at")
  @@db("tags")
}

model TagGroup {
  id Int @id
  createdAt DateTime? @db("created_at")
  name String
  onePerTopic Boolean? @db("one_per_topic")
  parentTagId Int? @db("parent_tag_id")
  updatedAt DateTime? @db("updated_at")
  @@db("tag_groups")
}

model TagGroupMembership {
  id Int @id
  createdAt DateTime? @db("created_at")
  tagGroupId Int @db("tag_group_id")
  tagId Int @db("tag_id")
  updatedAt DateTime? @db("updated_at")
  @@db("tag_group_memberships")
}

model TagGroupPermission {
  id Int @id
  createdAt DateTime @db("created_at")
  groupId Int @db("group_id")
  permissionType Int @db("permission_type")
  tagGroupId Int @db("tag_group_id")
  updatedAt DateTime @db("updated_at")
  @@db("tag_group_permissions")
}

model TagSearchDatum {
  tag_id Int @id
  locale String?
  rawData String? @db("raw_data")
  version Int?
  @@db("tag_search_data")
}

model TagUser {
  id Int @id
  createdAt DateTime? @db("created_at")
  notificationLevel Int @db("notification_level")
  tagId Int @db("tag_id")
  updatedAt DateTime? @db("updated_at")
  userId Int @db("user_id")
  @@db("tag_users")
}

model Theme {
  id Int @id
  colorSchemeId Int? @db("color_scheme_id")
  compilerVersion Int @db("compiler_version")
  component Boolean
  createdAt DateTime @db("created_at")
  hidden Boolean
  name String
  remoteThemeId Int? @db("remote_theme_id") @unique
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  userSelectable Boolean @db("user_selectable")
  @@db("themes")
}

model ThemeField {
  id Int @id
  compilerVersion Int @db("compiler_version")
  createdAt DateTime? @db("created_at")
  error String?
  name String
  targetId Int @db("target_id")
  themeId Int @db("theme_id")
  typeId Int @db("type_id")
  updatedAt DateTime? @db("updated_at")
  uploadId Int? @db("upload_id")
  value String
  valueBaked String? @db("value_baked")
  @@db("theme_fields")
}

model ThemeSetting {
  id Int @id
  createdAt DateTime @db("created_at")
  dataType Int @db("data_type")
  name String
  themeId Int @db("theme_id")
  updatedAt DateTime @db("updated_at")
  value String?
  @@db("theme_settings")
}

model TopTopic {
  id Int @id
  allScore Float? @db("all_score")
  dailyLikesCount Int @db("daily_likes_count")
  dailyOpLikesCount Int @db("daily_op_likes_count")
  dailyPostsCount Int @db("daily_posts_count")
  dailyScore Float? @db("daily_score")
  dailyViewsCount Int @db("daily_views_count")
  monthlyLikesCount Int @db("monthly_likes_count")
  monthlyOpLikesCount Int @db("monthly_op_likes_count")
  monthlyPostsCount Int @db("monthly_posts_count")
  monthlyScore Float? @db("monthly_score")
  monthlyViewsCount Int @db("monthly_views_count")
  quarterlyLikesCount Int @db("quarterly_likes_count")
  quarterlyOpLikesCount Int @db("quarterly_op_likes_count")
  quarterlyPostsCount Int @db("quarterly_posts_count")
  quarterlyScore Float? @db("quarterly_score")
  quarterlyViewsCount Int @db("quarterly_views_count")
  topicId Int? @db("topic_id") @unique
  weeklyLikesCount Int @db("weekly_likes_count")
  weeklyOpLikesCount Int @db("weekly_op_likes_count")
  weeklyPostsCount Int @db("weekly_posts_count")
  weeklyScore Float? @db("weekly_score")
  weeklyViewsCount Int @db("weekly_views_count")
  yearlyLikesCount Int @db("yearly_likes_count")
  yearlyOpLikesCount Int @db("yearly_op_likes_count")
  yearlyPostsCount Int @db("yearly_posts_count")
  yearlyScore Float? @db("yearly_score")
  yearlyViewsCount Int @db("yearly_views_count")
  @@db("top_topics")
}

model Topic {
  id Int @id
  archetype String
  archived Boolean
  avgTime Int? @db("avg_time")
  bumpedAt DateTime @db("bumped_at")
  categoryId Int? @db("category_id")
  closed Boolean
  createdAt DateTime @db("created_at")
  deletedAt DateTime? @db("deleted_at")
  deletedById Int? @db("deleted_by_id")
  excerpt String?
  fancyTitle String? @db("fancy_title")
  featuredLink String? @db("featured_link")
  featuredUser1Id Int? @db("featured_user1_id")
  featuredUser2Id Int? @db("featured_user2_id")
  featuredUser3Id Int? @db("featured_user3_id")
  featuredUser4Id Int? @db("featured_user4_id")
  hasSummary Boolean @db("has_summary")
  highestPostNumber Int @db("highest_post_number")
  highestStaffPostNumber Int @db("highest_staff_post_number")
  imageUrl String? @db("image_url")
  incomingLinkCount Int @db("incoming_link_count")
  lastPostedAt DateTime? @db("last_posted_at")
  lastPostUserId Int @db("last_post_user_id")
  likeCount Int @db("like_count")
  moderatorPostsCount Int @db("moderator_posts_count")
  notifyModeratorsCount Int @db("notify_moderators_count")
  participantCount Int? @db("participant_count")
  percentRank Float @db("percent_rank")
  pinnedAt DateTime? @db("pinned_at")
  pinnedGlobally Boolean @db("pinned_globally")
  pinnedUntil DateTime? @db("pinned_until")
  postsCount Int @db("posts_count")
  replyCount Int @db("reply_count")
  score Float?
  slug String?
  spamCount Int @db("spam_count")
  subtype String?
  title String
  updatedAt DateTime @db("updated_at")
  userId Int? @db("user_id")
  views Int
  visible Boolean
  wordCount Int? @db("word_count")
  @@db("topics")
}

model TopicAllowedGroup {
  id Int @id
  groupId Int @db("group_id")
  topicId Int @db("topic_id")
  @@db("topic_allowed_groups")
}

model TopicAllowedUser {
  id Int @id
  createdAt DateTime @db("created_at")
  topicId Int @db("topic_id")
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  @@db("topic_allowed_users")
}

model TopicCustomField {
  id Int @id
  createdAt DateTime @db("created_at")
  name String
  topicId Int @db("topic_id")
  updatedAt DateTime @db("updated_at")
  value String?
  @@db("topic_custom_fields")
}

model TopicEmbed {
  id Int @id
  contentSha1 String? @db("content_sha1")
  createdAt DateTime @db("created_at")
  deletedAt DateTime? @db("deleted_at")
  deletedById Int? @db("deleted_by_id")
  embedUrl String @db("embed_url") @unique
  postId Int @db("post_id")
  topicId Int @db("topic_id")
  updatedAt DateTime @db("updated_at")
  @@db("topic_embeds")
}

model TopicInvite {
  id Int @id
  createdAt DateTime @db("created_at")
  inviteId Int @db("invite_id")
  topicId Int @db("topic_id")
  updatedAt DateTime @db("updated_at")
  @@db("topic_invites")
}

model TopicLink {
  id Int @id
  clicks Int
  crawledAt DateTime? @db("crawled_at")
  createdAt DateTime @db("created_at")
  domain String
  extension String?
  internal Boolean
  linkPostId Int? @db("link_post_id")
  linkTopicId Int? @db("link_topic_id")
  postId Int? @db("post_id")
  quote Boolean
  reflection Boolean?
  title String?
  topicId Int @db("topic_id")
  updatedAt DateTime @db("updated_at")
  url String
  userId Int @db("user_id")
  @@db("topic_links")
}

model TopicLinkClick {
  id Int @id
  createdAt DateTime @db("created_at")
  topicLinkId Int @db("topic_link_id")
  updatedAt DateTime @db("updated_at")
  userId Int? @db("user_id")
  @@db("topic_link_clicks")
}

model TopicSearchDatum {
  topic_id Int @id
  locale String
  rawData String? @db("raw_data")
  version Int?
  @@db("topic_search_data")
}

model TopicTag {
  id Int @id
  createdAt DateTime? @db("created_at")
  tagId Int @db("tag_id")
  topicId Int @db("topic_id")
  updatedAt DateTime? @db("updated_at")
  @@db("topic_tags")
}

model TopicTimer {
  id Int @id
  basedOnLastPost Boolean @db("based_on_last_post")
  categoryId Int? @db("category_id")
  createdAt DateTime? @db("created_at")
  deletedAt DateTime? @db("deleted_at")
  deletedById Int? @db("deleted_by_id")
  executeAt DateTime @db("execute_at")
  publicType Boolean? @db("public_type")
  statusType Int @db("status_type")
  topicId Int @db("topic_id") @unique
  updatedAt DateTime? @db("updated_at")
  userId Int @db("user_id")
  @@db("topic_timers")
}

model TopicUser {
  id Int @id
  bookmarked Boolean?
  clearedPinnedAt DateTime? @db("cleared_pinned_at")
  firstVisitedAt DateTime? @db("first_visited_at")
  highestSeenPostNumber Int? @db("highest_seen_post_number")
  lastEmailedPostNumber Int? @db("last_emailed_post_number")
  lastReadPostNumber Int? @db("last_read_post_number")
  lastVisitedAt DateTime? @db("last_visited_at")
  liked Boolean?
  notificationLevel Int @db("notification_level")
  notificationsChangedAt DateTime? @db("notifications_changed_at")
  notificationsReasonId Int? @db("notifications_reason_id")
  posted Boolean
  topicId Int @db("topic_id")
  totalMsecsViewed Int @db("total_msecs_viewed")
  userId Int @db("user_id")
  @@db("topic_users")
}

model TranslationOverride {
  id Int @id
  compiledJs String? @db("compiled_js")
  createdAt DateTime @db("created_at")
  locale String
  translationKey String @db("translation_key")
  updatedAt DateTime @db("updated_at")
  value String
  @@db("translation_overrides")
}

model TwitterUserInfo {
  id Int @id
  createdAt DateTime @db("created_at")
  email String?
  screenName String @db("screen_name")
  twitterUserId Int @db("twitter_user_id") @unique
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id") @unique
  @@db("twitter_user_infos")
}

model UnsubscribeKey {
  key String @default(cuid()) @id
  createdAt DateTime? @db("created_at")
  postId Int? @db("post_id")
  topicId Int? @db("topic_id")
  unsubscribeKeyType String? @db("unsubscribe_key_type")
  updatedAt DateTime? @db("updated_at")
  userId Int @db("user_id")
  @@db("unsubscribe_keys")
}

model Upload {
  id Int @id
  createdAt DateTime @db("created_at")
  extension String?
  filesize Int
  height Int?
  origin String?
  originalFilename String @db("original_filename")
  retainHours Int? @db("retain_hours")
  sha1 String? @unique
  thumbnailHeight Int? @db("thumbnail_height")
  thumbnailWidth Int? @db("thumbnail_width")
  updatedAt DateTime @db("updated_at")
  url String
  userId Int @db("user_id")
  width Int?
  @@db("uploads")
}

model User {
  id Int @id
  active Boolean
  admin Boolean
  approved Boolean
  approvedAt DateTime? @db("approved_at")
  approvedById Int? @db("approved_by_id")
  createdAt DateTime @db("created_at")
  dateOfBirth DateTime? @db("date_of_birth")
  firstSeenAt DateTime? @db("first_seen_at")
  flagLevel Int @db("flag_level")
  groupLockedTrustLevel Int? @db("group_locked_trust_level")
  lastEmailedAt DateTime? @db("last_emailed_at")
  lastPostedAt DateTime? @db("last_posted_at")
  lastSeenAt DateTime? @db("last_seen_at")
  locale String?
  manualLockedTrustLevel Int? @db("manual_locked_trust_level")
  moderator Boolean?
  name String?
  passwordHash String? @db("password_hash")
  previousVisitAt DateTime? @db("previous_visit_at")
  primaryGroupId Int? @db("primary_group_id")
  salt String?
  seenNotificationId Int @db("seen_notification_id")
  silencedTill DateTime? @db("silenced_till")
  staged Boolean
  suspendedAt DateTime? @db("suspended_at")
  suspendedTill DateTime? @db("suspended_till")
  title String?
  trustLevel Int @db("trust_level")
  updatedAt DateTime @db("updated_at")
  uploadedAvatarId Int? @db("uploaded_avatar_id")
  username String @unique
  usernameLower String @db("username_lower") @unique
  views Int
  @@db("users")
}

model UserAction {
  id Int @id
  actingUserId Int? @db("acting_user_id")
  actionType Int @db("action_type")
  createdAt DateTime @db("created_at")
  queuedPostId Int? @db("queued_post_id")
  targetPostId Int? @db("target_post_id")
  targetTopicId Int? @db("target_topic_id")
  targetUserId Int? @db("target_user_id")
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  @@db("user_actions")
}

model UserApiKey {
  id Int @id
  applicationName String @db("application_name")
  clientId String @db("client_id") @unique
  createdAt DateTime? @db("created_at")
  key String @unique
  lastUsedAt DateTime @db("last_used_at")
  pushUrl String? @db("push_url")
  revokedAt DateTime? @db("revoked_at")
  scopes String
  updatedAt DateTime? @db("updated_at")
  userId Int @db("user_id")
  @@db("user_api_keys")
}

model UserArchivedMessage {
  id Int @id
  createdAt DateTime? @db("created_at")
  topicId Int @db("topic_id")
  updatedAt DateTime? @db("updated_at")
  userId Int @db("user_id")
  @@db("user_archived_messages")
}

model UserAuthToken {
  id Int @id
  authToken String @db("auth_token") @unique
  authTokenSeen Boolean @db("auth_token_seen")
  createdAt DateTime? @db("created_at")
  prevAuthToken String @db("prev_auth_token") @unique
  rotatedAt DateTime @db("rotated_at")
  seenAt DateTime? @db("seen_at")
  updatedAt DateTime? @db("updated_at")
  userAgent String? @db("user_agent")
  userId Int @db("user_id")
  @@db("user_auth_tokens")
}

model UserAuthTokenLog {
  id Int @id
  action String
  authToken String? @db("auth_token")
  createdAt DateTime? @db("created_at")
  path String?
  userAgent String? @db("user_agent")
  userAuthTokenId Int? @db("user_auth_token_id")
  userId Int? @db("user_id")
  @@db("user_auth_token_logs")
}

model UserAvatar {
  id Int @id
  createdAt DateTime @db("created_at")
  customUploadId Int? @db("custom_upload_id")
  gravatarUploadId Int? @db("gravatar_upload_id")
  lastGravatarDownloadAttempt DateTime? @db("last_gravatar_download_attempt")
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  @@db("user_avatars")
}

model UserBadge {
  id Int @id
  badgeId Int @db("badge_id")
  grantedAt DateTime @db("granted_at")
  grantedById Int @db("granted_by_id")
  notificationId Int? @db("notification_id")
  postId Int? @db("post_id")
  seq Int
  userId Int @db("user_id")
  @@db("user_badges")
}

model UserCustomField {
  id Int @id
  createdAt DateTime @db("created_at")
  name String
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  value String?
  @@db("user_custom_fields")
}

model UserEmail {
  id Int @id
  createdAt DateTime? @db("created_at")
  email String
  primary Boolean
  updatedAt DateTime? @db("updated_at")
  userId Int @db("user_id")
  @@db("user_emails")
}

model UserExport {
  id Int @id
  createdAt DateTime? @db("created_at")
  fileName String @db("file_name")
  updatedAt DateTime? @db("updated_at")
  uploadId Int? @db("upload_id")
  userId Int @db("user_id")
  @@db("user_exports")
}

model UserField {
  id Int @id
  createdAt DateTime? @db("created_at")
  description String
  editable Boolean
  externalName String? @db("external_name")
  externalType String? @db("external_type")
  fieldType String @db("field_type")
  name String
  position Int?
  required Boolean
  showOnProfile Boolean @db("show_on_profile")
  showOnUserCard Boolean @db("show_on_user_card")
  updatedAt DateTime? @db("updated_at")
  @@db("user_fields")
}

model UserFieldOption {
  id Int @id
  createdAt DateTime? @db("created_at")
  updatedAt DateTime? @db("updated_at")
  userFieldId Int @db("user_field_id")
  value String
  @@db("user_field_options")
}

model UserHistory {
  id Int @id
  actingUserId Int? @db("acting_user_id")
  action Int
  adminOnly Boolean? @db("admin_only")
  categoryId Int? @db("category_id")
  context String?
  createdAt DateTime @db("created_at")
  customType String? @db("custom_type")
  details String?
  email String?
  ipAddress String? @db("ip_address")
  newValue String? @db("new_value")
  postId Int? @db("post_id")
  previousValue String? @db("previous_value")
  subject String?
  targetUserId Int? @db("target_user_id")
  topicId Int? @db("topic_id")
  updatedAt DateTime @db("updated_at")
  @@db("user_histories")
}

model UserOpenId {
  id Int @id
  active Boolean
  createdAt DateTime @db("created_at")
  email String
  updatedAt DateTime @db("updated_at")
  url String
  userId Int @db("user_id")
  @@db("user_open_ids")
}

model UserOption {
  user_id Int @id @unique
  allowPrivateMessages Boolean @db("allow_private_messages")
  automaticallyUnpinTopics Boolean @db("automatically_unpin_topics")
  autoTrackTopicsAfterMsecs Int? @db("auto_track_topics_after_msecs")
  digestAfterMinutes Int? @db("digest_after_minutes")
  disableJumpReply Boolean @db("disable_jump_reply")
  dynamicFavicon Boolean @db("dynamic_favicon")
  emailAlways Boolean @db("email_always")
  emailDigests Boolean? @db("email_digests")
  emailDirect Boolean @db("email_direct")
  emailInReplyTo Boolean @db("email_in_reply_to")
  emailPreviousReplies Int @db("email_previous_replies")
  emailPrivateMessages Boolean @db("email_private_messages")
  enableQuoting Boolean @db("enable_quoting")
  externalLinksInNewTab Boolean @db("external_links_in_new_tab")
  hideProfileAndPresence Boolean @db("hide_profile_and_presence")
  homepageId Int? @db("homepage_id")
  includeTl0InDigests Boolean? @db("include_tl0_in_digests")
  lastRedirectedToTopAt DateTime? @db("last_redirected_to_top_at")
  likeNotificationFrequency Int @db("like_notification_frequency")
  mailingListMode Boolean @db("mailing_list_mode")
  mailingListModeFrequency Int @db("mailing_list_mode_frequency")
  newTopicDurationMinutes Int? @db("new_topic_duration_minutes")
  notificationLevelWhenReplying Int? @db("notification_level_when_replying")
  themeIds Int @db("theme_ids")
  themeKeySeq Int @db("theme_key_seq")
  @@db("user_options")
}

model UserProfile {
  user_id Int @id
  badgeGrantedTitle Boolean? @db("badge_granted_title")
  bioCooked String? @db("bio_cooked")
  bioCookedVersion Int? @db("bio_cooked_version")
  bioRaw String? @db("bio_raw")
  cardBackground String? @db("card_background")
  dismissedBannerKey Int? @db("dismissed_banner_key")
  location String?
  profileBackground String? @db("profile_background")
  views Int
  website String?
  @@db("user_profiles")
}

model UserProfileView {
  id Int @id
  userId Int? @db("user_id")
  userProfileId Int @db("user_profile_id")
  viewedAt DateTime @db("viewed_at")
  @@db("user_profile_views")
}

model UserSearchDatum {
  user_id Int @id
  locale String?
  rawData String? @db("raw_data")
  version Int?
  @@db("user_search_data")
}

model UserSecondFactor {
  id Int @id
  createdAt DateTime @db("created_at")
  data String
  enabled Boolean
  lastUsed DateTime? @db("last_used")
  method Int
  updatedAt DateTime @db("updated_at")
  userId Int @db("user_id")
  @@db("user_second_factors")
}

model UserStat {
  user_id Int @id
  bounceScore Float @db("bounce_score")
  daysVisited Int @db("days_visited")
  firstPostCreatedAt DateTime? @db("first_post_created_at")
  likesGiven Int @db("likes_given")
  likesReceived Int @db("likes_received")
  newSince DateTime @db("new_since")
  postCount Int @db("post_count")
  postsReadCount Int @db("posts_read_count")
  readFaq DateTime? @db("read_faq")
  resetBounceScoreAfter DateTime? @db("reset_bounce_score_after")
  timeRead Int @db("time_read")
  topicCount Int @db("topic_count")
  topicReplyCount Int @db("topic_reply_count")
  topicsEntered Int @db("topics_entered")
  @@db("user_stats")
}

model UserUpload {
  id Int @id
  createdAt DateTime @db("created_at")
  uploadId Int @db("upload_id")
  userId Int @db("user_id")
  @@db("user_uploads")
}

model UserVisit {
  id Int @id
  mobile Boolean?
  postsRead Int? @db("posts_read")
  timeRead Int @db("time_read")
  userId Int @db("user_id")
  visitedAt DateTime @db("visited_at")
  @@db("user_visits")
}

model UserWarning {
  id Int @id
  createdAt DateTime? @db("created_at")
  createdById Int @db("created_by_id")
  topicId Int @db("topic_id") @unique
  updatedAt DateTime? @db("updated_at")
  userId Int @db("user_id")
  @@db("user_warnings")
}

model WatchedWord {
  id Int @id
  action Int
  createdAt DateTime? @db("created_at")
  updatedAt DateTime? @db("updated_at")
  word String
  @@db("watched_words")
}

model WebCrawlerRequest {
  id Int @id
  count Int
  date DateTime
  userAgent String @db("user_agent")
  @@db("web_crawler_requests")
}

model WebHook {
  id Int @id
  active Boolean
  contentType Int @db("content_type")
  createdAt DateTime? @db("created_at")
  lastDeliveryStatus Int @db("last_delivery_status")
  payloadUrl String @db("payload_url")
  secret String?
  status Int
  updatedAt DateTime? @db("updated_at")
  verifyCertificate Boolean @db("verify_certificate")
  wildcardWebHook Boolean @db("wildcard_web_hook")
  @@db("web_hooks")
}

model WebHookEvent {
  id Int @id
  createdAt DateTime? @db("created_at")
  duration Int?
  headers String?
  payload String?
  responseBody String? @db("response_body")
  responseHeaders String? @db("response_headers")
  status Int?
  updatedAt DateTime? @db("updated_at")
  webHookId Int @db("web_hook_id")
  @@db("web_hook_events")
}

model WebHookEventType {
  id Int @id
  name String
  @@db("web_hook_event_types")
}`
