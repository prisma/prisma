export const optonaut = `datasource db {
  provider = "postgres"
  url      = "postgresql://localhost:5432/optonaut?schema=public"
}

generator photon {
  provider = "photonjs"
  output   = "node_modules/@generated/photon"
}

model Activity {
  activity_id                     String                   @default(uuid()) @id
  activityActivityResourceComment ActivityResourceComment? @map("activity_activity_resource_comment_id")
  activityActivityResourceFollow  ActivityResourceFollow?  @map("activity_activity_resource_follow_id")
  activityActivityResourceStar    ActivityResourceStar?    @map("activity_activity_resource_star_id")
  activityActivityResourceViews   ActivityResourceView?    @map("activity_activity_resource_views_id")
  activityCreatedAt               DateTime                 @map("activity_created_at")
  activityDeletedAt               DateTime?                @map("activity_deleted_at")
  activityIsRead                  Boolean                  @map("activity_is_read")
  activityPerson                  Person                   @map("activity_person_id")
  activityType                    String                   @map("activity_type")
  activityUpdatedAt               DateTime                 @map("activity_updated_at")

  @@map("activity")
}

model ActivityResourceComment {
  activity_resource_comment_id         String     @default(uuid()) @id
  activity                             Activity[]
  activityResourceCommentCausingPerson Person     @map("activity_resource_comment_causing_person_id")
  activityResourceCommentComment       Comment    @map("activity_resource_comment_comment_id")
  activityResourceCommentOptograph     Optograph  @map("activity_resource_comment_optograph_id")

  @@map("activity_resource_comment")
}

model ActivityResourceFollow {
  activity_resource_follow_id         String     @default(uuid()) @id
  activity                            Activity[]
  activityResourceFollowCausingPerson Person     @map("activity_resource_follow_causing_person_id")

  @@map("activity_resource_follow")
}

model ActivityResourceStar {
  activity_resource_star_id         String     @default(uuid()) @id
  activity                          Activity[]
  activityResourceStarCausingPerson Person     @map("activity_resource_star_causing_person_id")
  activityResourceStarOptograph     Optograph  @map("activity_resource_star_optograph_id")

  @@map("activity_resource_star")
}

model ActivityResourceView {
  activity_resource_views_id     String     @default(uuid()) @id
  activity                       Activity[]
  activityResourceViewsCount     Int        @map("activity_resource_views_count")
  activityResourceViewsOptograph Optograph  @map("activity_resource_views_optograph_id")

  @@map("activity_resource_views")
}

model Comment {
  comment_id              String                    @default(uuid()) @id
  activityResourceComment ActivityResourceComment[]
  commentCreatedAt        DateTime                  @map("comment_created_at")
  commentDeletedAt        DateTime?                 @map("comment_deleted_at")
  commentOptograph        Optograph                 @map("comment_optograph_id")
  commentPerson           Person                    @map("comment_person_id")
  commentText             String                    @map("comment_text")
  commentUpdatedAt        DateTime                  @map("comment_updated_at")

  @@map("comment")
}

model FollowHashtag {
  follow_hashtag_id      String    @default(uuid()) @id
  followHashtagCreatedAt DateTime  @map("follow_hashtag_created_at")
  followHashtagDeletedAt DateTime? @map("follow_hashtag_deleted_at")
  followHashtagHashtag   Hashtag   @map("follow_hashtag_hashtag_id")
  followHashtagPerson    Person    @map("follow_hashtag_person_id")
  followHashtagUpdatedAt DateTime  @map("follow_hashtag_updated_at")

  @@map("follow_hashtag")
}

model FollowPerson {
  follow_person_id           String    @default(uuid()) @id
  followPersonCreatedAt      DateTime  @map("follow_person_created_at")
  followPersonDeletedAt      DateTime? @map("follow_person_deleted_at")
  followPersonFollowedPerson Person    @map("follow_person_followed_person_id") @relation("FollowPersonFollowPersonFollowedPersonToPersonFollowPerson")
  followPersonFollowerPerson Person    @map("follow_person_follower_person_id") @relation("FollowPersonFollowPersonFollowerPersonToPersonFollowPerson")
  followPersonUpdatedAt      DateTime  @map("follow_person_updated_at")

  @@map("follow_person")
}

model Hashtag {
  hashtag_id                   String                         @default(uuid()) @id
  followHashtag                FollowHashtag[]
  hashtagCreatedAt             DateTime                       @map("hashtag_created_at")
  hashtagDeletedAt             DateTime?                      @map("hashtag_deleted_at")
  hashtagIsStaffPick           Boolean                        @map("hashtag_is_staff_pick")
  hashtagName                  String                         @map("hashtag_name") @unique
  hashtagPreviewAssetId        String                         @default(uuid()) @map("hashtag_preview_asset_id")
  hashtagUpdatedAt             DateTime                       @map("hashtag_updated_at")
  relationshipHashtagOptograph RelationshipHashtagOptograph[]

  @@map("hashtag")
}

model Location {
  location_id       String      @default(uuid()) @id
  locationCountry   String      @map("location_country")
  locationCreatedAt DateTime    @map("location_created_at")
  locationDeletedAt DateTime?   @map("location_deleted_at")
  locationLatitude  Float       @map("location_latitude")
  locationLongitude Float       @map("location_longitude")
  locationText      String      @map("location_text")
  locationUpdatedAt DateTime    @map("location_updated_at")
  optograph         Optograph[]

  @@map("location")
}

model Optograph {
  optograph_id                 String                         @default(uuid()) @id
  activityResourceComment      ActivityResourceComment[]
  activityResourceStar         ActivityResourceStar[]
  activityResourceViews        ActivityResourceView[]
  comment                      Comment[]
  optographCreatedAt           DateTime                       @map("optograph_created_at")
  optographDeletedAt           DateTime?                      @map("optograph_deleted_at")
  optographIsPrivate           Boolean                        @map("optograph_is_private")
  optographIsStaffPick         Boolean                        @map("optograph_is_staff_pick")
  optographLeftTextureAssetId  String                         @default(uuid())@map("optograph_left_texture_asset_id")
  optographLocation            Location                       @map("optograph_location_id")
  optographPerson              Person                         @map("optograph_person_id")
  optographPreviewAssetId      String                         @default(uuid()) @map("optograph_preview_asset_id")
  optographRightTextureAssetId String                         @default(uuid()) @map("optograph_right_texture_asset_id")
  optographShareAlias          String                         @map("optograph_share_alias") @unique
  optographStitcherVersion     String                         @map("optograph_stitcher_version")
  optographText                String                         @map("optograph_text")
  optographUpdatedAt           DateTime                       @map("optograph_updated_at")
  optographViewsCount          Int                            @map("optograph_views_count")
  relationshipHashtagOptograph RelationshipHashtagOptograph[]
  star                         Star[]

  @@map("optograph")
}

model Person {
  person_id                       String                    @default(uuid()) @id
  activity                        Activity[]
  activityResourceComment         ActivityResourceComment[]
  activityResourceFollow          ActivityResourceFollow[]
  activityResourceStar            ActivityResourceStar[]
  comment                         Comment[]
  followHashtag                   FollowHashtag[]
  followPerson                    FollowPerson[]            @relation("FollowPersonFollowPersonFollowedPersonToPersonFollowPerson")
  followPerson                    FollowPerson[]            @relation("FollowPersonFollowPersonFollowerPersonToPersonFollowPerson")
  optograph                       Optograph[]
  personAvatarAssetId             String?                   @default(uuid()) @map("person_avatar_asset_id")
  personCreatedAt                 DateTime                  @map("person_created_at")
  personDeletedAt                 DateTime?                 @map("person_deleted_at")
  personDisplayName               String                    @map("person_display_name")
  personEmail                     String                    @map("person_email") @unique
  personFacebookUserId            String?                   @map("person_facebook_user_id") @unique
  personHashedPassword            String?                   @map("person_hashed_password")
  personInviteActivationActivated Boolean                   @map("person_invite_activation_activated")
  personInviteActivationAt        DateTime?                 @map("person_invite_activation_at")
  personInviteActivationId        String?                   @default(uuid()) @map("person_invite_activation_id")
  personIsActive                  Boolean                   @map("person_is_active")
  personLastLoginAt               DateTime?                 @map("person_last_login_at")
  personOnboardingVersion         Int                       @map("person_onboarding_version")
  personPasswordToken             String?                   @default(uuid()) @map("person_password_token")
  personText                      String                    @map("person_text")
  personUpdatedAt                 DateTime                  @map("person_updated_at")
  personUserName                  String                    @map("person_user_name") @unique
  personWantsNewsletter           Boolean                   @map("person_wants_newsletter")
  star                            Star[]

  @@map("person")
}

model RelationshipHashtagOptograph {
  relationshipHashtagOptographHashtag   Hashtag   @map("relationship_hashtag_optograph_hashtag_id")
  relationshipHashtagOptographOptograph Optograph @map("relationship_hashtag_optograph_optograph_id")

  @@map("relationship_hashtag_optograph")
}

model Star {
  star_id       String    @default(uuid()) @id
  starCreatedAt DateTime  @map("star_created_at")
  starDeletedAt DateTime? @map("star_deleted_at")
  starOptograph Optograph @map("star_optograph_id")
  starPerson    Person    @map("star_person_id")
  starUpdatedAt DateTime  @map("star_updated_at")

  @@map("star")
}`
