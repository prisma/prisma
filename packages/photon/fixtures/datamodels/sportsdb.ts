export const sportsdb = /* GraphQL */ `
  type Address @map(name: "addresses") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "addresses_id_seq", initialValue: 1, allocationSize: 1)
    building: String
    country: String
    county: String
    district: String
    floor: String
    language: String
    locality: String
    locationId: Location! @map(name: "location_id")
    neighborhood: String
    postalCode: String @map(name: "postal_code")
    region: String
    street: String
    streetNumber: String @map(name: "street_number")
    streetPrefix: String @map(name: "street_prefix")
    streetSuffix: String @map(name: "street_suffix")
    suite: String
  }

  type Affiliation @map(name: "affiliations") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "affiliations_id_seq", initialValue: 1, allocationSize: 1)
    affiliationKey: String! @map(name: "affiliation_key")
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references AffiliationPhase.ancestorAffiliationId.
    # affiliationPhases: [AffiliationPhase]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references AffiliationPhase.affiliationId.
    # affiliationPhases: [AffiliationPhase]
    affiliationsDocuments: [AffiliationsDocument]
    affiliationsEvents: [AffiliationsEvent]
    affiliationsMedia: [AffiliationsMedia]
    affiliationType: String @map(name: "affiliation_type")
    positions: [Position]
    publisherId: Publisher! @map(name: "publisher_id")
    seasons: [Season]
    standings: [Standing]
    standingSubgroups: [StandingSubgroup]
    teamPhases: [TeamPhase]
  }

  type AffiliationPhase @map(name: "affiliation_phases") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "affiliation_phases_id_seq", initialValue: 1, allocationSize: 1)
    affiliationId: Affiliation! @map(name: "affiliation_id")
    ancestorAffiliationId: Affiliation @map(name: "ancestor_affiliation_id")
    endDateTime: DateTime @map(name: "end_date_time")
    endSeasonId: Season @map(name: "end_season_id")
    startDateTime: DateTime @map(name: "start_date_time")
    startSeasonId: Season @map(name: "start_season_id")
  }

  type AffiliationsDocument @map(name: "affiliations_documents") @linkTable {
    affiliationId: Affiliation! @map(name: "affiliation_id")
    documentId: Document! @map(name: "document_id")
  }

  type AffiliationsEvent @map(name: "affiliations_events") @linkTable {
    affiliationId: Affiliation! @map(name: "affiliation_id")
    eventId: Event! @map(name: "event_id")
  }

  type AffiliationsMedia @map(name: "affiliations_media") @linkTable {
    affiliationId: Affiliation! @map(name: "affiliation_id")
    mediaId: Media! @map(name: "media_id")
  }

  type AmericanFootballActionParticipant @map(name: "american_football_action_participants") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "american_football_action_participants_id_seq", initialValue: 1, allocationSize: 1)
    americanFootballActionPlayId: AmericanFootballActionPlay! @map(name: "american_football_action_play_id")
    fieldLine: Int @map(name: "field_line")
    participantRole: String! @map(name: "participant_role")
    personId: Person! @map(name: "person_id")
    scoreCredit: Int @map(name: "score_credit")
    scoreType: String @map(name: "score_type")
    yardage: Int
    yardsGained: Int @map(name: "yards_gained")
  }

  type AmericanFootballActionPlay @map(name: "american_football_action_plays") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "american_football_action_plays_id_seq", initialValue: 1, allocationSize: 1)
    americanFootballActionParticipants: [AmericanFootballActionParticipant]
    americanFootballEventStateId: AmericanFootballEventState! @map(name: "american_football_event_state_id")
    comment: String
    driveResult: String @map(name: "drive_result")
    playType: String @map(name: "play_type")
    points: Int
    scoreAttemptType: String @map(name: "score_attempt_type")
  }

  type AmericanFootballDefensiveStat @map(name: "american_football_defensive_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "american_football_defensive_stats_id_seq", initialValue: 1, allocationSize: 1)
    interceptionsAverage: String @map(name: "interceptions_average")
    interceptionsLongest: String @map(name: "interceptions_longest")
    interceptionsTotal: String @map(name: "interceptions_total")
    interceptionsTouchdown: String @map(name: "interceptions_touchdown")
    interceptionsYards: String @map(name: "interceptions_yards")
    passesDefensed: String @map(name: "passes_defensed")
    quarterbackHurries: String @map(name: "quarterback_hurries")
    sacksTotal: String @map(name: "sacks_total")
    sacksYards: String @map(name: "sacks_yards")
    tacklesAssists: String @map(name: "tackles_assists")
    tacklesSolo: String @map(name: "tackles_solo")
    tacklesTotal: String @map(name: "tackles_total")
  }

  type AmericanFootballDownProgressStat @map(name: "american_football_down_progress_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "american_football_down_progress_stats_id_seq", initialValue: 1, allocationSize: 1)
    conversionsFourthDown: String @map(name: "conversions_fourth_down")
    conversionsFourthDownAttempts: String @map(name: "conversions_fourth_down_attempts")
    conversionsFourthDownPercentage: String @map(name: "conversions_fourth_down_percentage")
    conversionsThirdDown: String @map(name: "conversions_third_down")
    conversionsThirdDownAttempts: String @map(name: "conversions_third_down_attempts")
    conversionsThirdDownPercentage: String @map(name: "conversions_third_down_percentage")
    firstDownsPass: String @map(name: "first_downs_pass")
    firstDownsPenalty: String @map(name: "first_downs_penalty")
    firstDownsRun: String @map(name: "first_downs_run")
    firstDownsTotal: String @map(name: "first_downs_total")
  }

  type AmericanFootballEventState @map(name: "american_football_event_states") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "american_football_event_states_id_seq", initialValue: 1, allocationSize: 1)
    americanFootballActionPlays: [AmericanFootballActionPlay]
    clockState: String @map(name: "clock_state")
    context: String
    currentState: Int @map(name: "current_state")
    distanceFor1stDown: Int @map(name: "distance_for_1st_down")
    down: Int
    eventId: Event! @map(name: "event_id")
    fieldLine: Int @map(name: "field_line")
    fieldSide: String @map(name: "field_side")
    periodTimeElapsed: String @map(name: "period_time_elapsed")
    periodTimeRemaining: String @map(name: "period_time_remaining")
    periodValue: Int @map(name: "period_value")
    sequenceNumber: Int @map(name: "sequence_number")
    teamInPossessionId: Team @map(name: "team_in_possession_id")
  }

  type AmericanFootballFumblesStat @map(name: "american_football_fumbles_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "american_football_fumbles_stats_id_seq", initialValue: 1, allocationSize: 1)
    fumblesCommitted: String @map(name: "fumbles_committed")
    fumblesForced: String @map(name: "fumbles_forced")
    fumblesLost: String @map(name: "fumbles_lost")
    fumblesOpposingCommitted: String @map(name: "fumbles_opposing_committed")
    fumblesOpposingLost: String @map(name: "fumbles_opposing_lost")
    fumblesOpposingRecovered: String @map(name: "fumbles_opposing_recovered")
    fumblesOpposingYardsGained: String @map(name: "fumbles_opposing_yards_gained")
    fumblesOwnCommitted: String @map(name: "fumbles_own_committed")
    fumblesOwnLost: String @map(name: "fumbles_own_lost")
    fumblesOwnRecovered: String @map(name: "fumbles_own_recovered")
    fumblesOwnYardsGained: String @map(name: "fumbles_own_yards_gained")
    fumblesRecovered: String @map(name: "fumbles_recovered")
    fumblesYardsGained: String @map(name: "fumbles_yards_gained")
  }

  type AmericanFootballOffensiveStat @map(name: "american_football_offensive_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "american_football_offensive_stats_id_seq", initialValue: 1, allocationSize: 1)
    offensivePlaysAverageYardsPer: String @map(name: "offensive_plays_average_yards_per")
    offensivePlaysNumber: String @map(name: "offensive_plays_number")
    offensivePlaysYards: String @map(name: "offensive_plays_yards")
    possessionDuration: String @map(name: "possession_duration")
    turnoversGiveaway: String @map(name: "turnovers_giveaway")
  }

  type AmericanFootballPassingStat @map(name: "american_football_passing_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "american_football_passing_stats_id_seq", initialValue: 1, allocationSize: 1)
    passerRating: String @map(name: "passer_rating")
    passesAttempts: String @map(name: "passes_attempts")
    passesAverageYardsPer: String @map(name: "passes_average_yards_per")
    passesCompletions: String @map(name: "passes_completions")
    passesInterceptions: String @map(name: "passes_interceptions")
    passesInterceptionsPercentage: String @map(name: "passes_interceptions_percentage")
    passesLongest: String @map(name: "passes_longest")
    passesPercentage: String @map(name: "passes_percentage")
    passesTouchdowns: String @map(name: "passes_touchdowns")
    passesTouchdownsPercentage: String @map(name: "passes_touchdowns_percentage")
    passesYardsGross: String @map(name: "passes_yards_gross")
    passesYardsLost: String @map(name: "passes_yards_lost")
    passesYardsNet: String @map(name: "passes_yards_net")
    receptionsAverageYardsPer: String @map(name: "receptions_average_yards_per")
    receptionsFirstDown: String @map(name: "receptions_first_down")
    receptionsLongest: String @map(name: "receptions_longest")
    receptionsTotal: String @map(name: "receptions_total")
    receptionsTouchdowns: String @map(name: "receptions_touchdowns")
    receptionsYards: String @map(name: "receptions_yards")
  }

  type AmericanFootballPenaltiesStat @map(name: "american_football_penalties_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "american_football_penalties_stats_id_seq", initialValue: 1, allocationSize: 1)
    penaltiesTotal: String @map(name: "penalties_total")
    penaltyFirstDowns: String @map(name: "penalty_first_downs")
    penaltyYards: String @map(name: "penalty_yards")
  }

  type AmericanFootballRushingStat @map(name: "american_football_rushing_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "american_football_rushing_stats_id_seq", initialValue: 1, allocationSize: 1)
    rushesAttempts: String @map(name: "rushes_attempts")
    rushesFirstDown: String @map(name: "rushes_first_down")
    rushesLongest: String @map(name: "rushes_longest")
    rushesTouchdowns: String @map(name: "rushes_touchdowns")
    rushesYards: String @map(name: "rushes_yards")
    rushingAverageYardsPer: String @map(name: "rushing_average_yards_per")
  }

  type AmericanFootballSacksAgainstStat @map(name: "american_football_sacks_against_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "american_football_sacks_against_stats_id_seq", initialValue: 1, allocationSize: 1)
    sacksAgainstTotal: String @map(name: "sacks_against_total")
    sacksAgainstYards: String @map(name: "sacks_against_yards")
  }

  type AmericanFootballScoringStat @map(name: "american_football_scoring_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "american_football_scoring_stats_id_seq", initialValue: 1, allocationSize: 1)
    extraPointsAttempts: String @map(name: "extra_points_attempts")
    extraPointsBlocked: String @map(name: "extra_points_blocked")
    extraPointsMade: String @map(name: "extra_points_made")
    extraPointsMissed: String @map(name: "extra_points_missed")
    fieldGoalAttempts: String @map(name: "field_goal_attempts")
    fieldGoalsBlocked: String @map(name: "field_goals_blocked")
    fieldGoalsMade: String @map(name: "field_goals_made")
    fieldGoalsMissed: String @map(name: "field_goals_missed")
    safetiesAgainst: String @map(name: "safeties_against")
    touchbacksTotal: String @map(name: "touchbacks_total")
    touchdownsDefensive: String @map(name: "touchdowns_defensive")
    touchdownsPassing: String @map(name: "touchdowns_passing")
    touchdownsRushing: String @map(name: "touchdowns_rushing")
    touchdownsSpecialTeams: String @map(name: "touchdowns_special_teams")
    touchdownsTotal: String @map(name: "touchdowns_total")
    twoPointConversionsAttempts: String @map(name: "two_point_conversions_attempts")
    twoPointConversionsMade: String @map(name: "two_point_conversions_made")
  }

  type AmericanFootballSpecialTeamsStat @map(name: "american_football_special_teams_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "american_football_special_teams_stats_id_seq", initialValue: 1, allocationSize: 1)
    fairCatches: String @map(name: "fair_catches")
    puntsAverage: String @map(name: "punts_average")
    puntsBlocked: String @map(name: "punts_blocked")
    puntsInside20: String @map(name: "punts_inside_20")
    puntsInside20Percentage: String @map(name: "punts_inside_20_percentage")
    puntsLongest: String @map(name: "punts_longest")
    puntsTotal: String @map(name: "punts_total")
    puntsYardsGross: String @map(name: "punts_yards_gross")
    puntsYardsNet: String @map(name: "punts_yards_net")
    returnsKickoffAverage: String @map(name: "returns_kickoff_average")
    returnsKickoffLongest: String @map(name: "returns_kickoff_longest")
    returnsKickoffTotal: String @map(name: "returns_kickoff_total")
    returnsKickoffTouchdown: String @map(name: "returns_kickoff_touchdown")
    returnsKickoffYards: String @map(name: "returns_kickoff_yards")
    returnsPuntAverage: String @map(name: "returns_punt_average")
    returnsPuntLongest: String @map(name: "returns_punt_longest")
    returnsPuntTotal: String @map(name: "returns_punt_total")
    returnsPuntTouchdown: String @map(name: "returns_punt_touchdown")
    returnsPuntYards: String @map(name: "returns_punt_yards")
    returnsTotal: String @map(name: "returns_total")
    returnsYards: String @map(name: "returns_yards")
    touchbacksInterceptions: String @map(name: "touchbacks_interceptions")
    touchbacksInterceptionsPercentage: String @map(name: "touchbacks_interceptions_percentage")
    touchbacksKickoffs: String @map(name: "touchbacks_kickoffs")
    touchbacksKickoffsPercentage: String @map(name: "touchbacks_kickoffs_percentage")
    touchbacksPunts: String @map(name: "touchbacks_punts")
    touchbacksPuntsPercentage: String @map(name: "touchbacks_punts_percentage")
    touchbacksTotal: String @map(name: "touchbacks_total")
    touchbacksTotalPercentage: String @map(name: "touchbacks_total_percentage")
  }

  type BaseballActionContactDetail @map(name: "baseball_action_contact_details") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "baseball_action_contact_details_id_seq", initialValue: 1, allocationSize: 1)
    baseballActionPitchId: BaseballActionPitch! @map(name: "baseball_action_pitch_id")
    comment: String
    location: String
    strength: String
    trajectoryCoordinates: String @map(name: "trajectory_coordinates")
    trajectoryFormula: String @map(name: "trajectory_formula")
    velocity: Int
  }

  type BaseballActionPitch @map(name: "baseball_action_pitches") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "baseball_action_pitches_id_seq", initialValue: 1, allocationSize: 1)
    ballType: String @map(name: "ball_type")
    baseballActionContactDetails: [BaseballActionContactDetail]
    baseballActionPlayId: BaseballActionPlay! @map(name: "baseball_action_play_id")
    baseballDefensiveGroupId: BaseballDefensiveGroup @map(name: "baseball_defensive_group_id")
    comment: String
    pitchLocation: String @map(name: "pitch_location")
    pitchType: String @map(name: "pitch_type")
    pitchVelocity: Int @map(name: "pitch_velocity")
    sequenceNumber: Int @map(name: "sequence_number")
    strikeType: String @map(name: "strike_type")
    trajectoryCoordinates: String @map(name: "trajectory_coordinates")
    trajectoryFormula: String @map(name: "trajectory_formula")
    umpireCall: String @map(name: "umpire_call")
  }

  type BaseballActionPlay @map(name: "baseball_action_plays") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "baseball_action_plays_id_seq", initialValue: 1, allocationSize: 1)
    baseballActionPitches: [BaseballActionPitch]
    baseballDefensiveGroupId: Int @map(name: "baseball_defensive_group_id")
    baseballEventStateId: BaseballEventState! @map(name: "baseball_event_state_id")
    comment: String
    earnedRunsScored: String @map(name: "earned_runs_scored")
    notation: String
    notationYaml: String @map(name: "notation_yaml")
    outsRecorded: Int @map(name: "outs_recorded")
    playType: String @map(name: "play_type")
    rbi: Int
    runnerOnFirstAdvance: Int @map(name: "runner_on_first_advance")
    runnerOnSecondAdvance: Int @map(name: "runner_on_second_advance")
    runnerOnThirdAdvance: Int @map(name: "runner_on_third_advance")
    runsScored: Int @map(name: "runs_scored")
  }

  type BaseballActionSubstitution @map(name: "baseball_action_substitutions") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "baseball_action_substitutions_id_seq", initialValue: 1, allocationSize: 1)
    baseballEventStateId: BaseballEventState! @map(name: "baseball_event_state_id")
    comment: String
    personOriginalId: Person @map(name: "person_original_id")
    personOriginalLineupSlot: Int @map(name: "person_original_lineup_slot")
    personOriginalPositionId: Position @map(name: "person_original_position_id")
    personReplacingId: Person @map(name: "person_replacing_id")
    personReplacingLineupSlot: Int @map(name: "person_replacing_lineup_slot")
    personReplacingPositionId: Position @map(name: "person_replacing_position_id")
    personType: String @map(name: "person_type")
    sequenceNumber: Int @map(name: "sequence_number")
    substitutionReason: String @map(name: "substitution_reason")
  }

  type BaseballDefensiveGroup @map(name: "baseball_defensive_group") @linkTable {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "baseball_defensive_group_id_seq", initialValue: 1, allocationSize: 1)
    baseballActionPitches: [BaseballActionPitch]
    baseballDefensivePlayers: [BaseballDefensivePlayer]
  }

  type BaseballDefensivePlayer @map(name: "baseball_defensive_players") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "baseball_defensive_players_id_seq", initialValue: 1, allocationSize: 1)
    baseballDefensiveGroupId: BaseballDefensiveGroup! @map(name: "baseball_defensive_group_id")
    playerId: Person! @map(name: "player_id")
    positionId: Position! @map(name: "position_id")
  }

  type BaseballDefensiveStat @map(name: "baseball_defensive_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "baseball_defensive_stats_id_seq", initialValue: 1, allocationSize: 1)
    assists: Int
    defensiveAverage: Float @map(name: "defensive_average")
    doublePlays: Int @map(name: "double_plays")
    errors: Int
    errorsCatchersInterference: Int @map(name: "errors_catchers_interference")
    errorsPassedBall: Int @map(name: "errors_passed_ball")
    fieldingPercentage: Float @map(name: "fielding_percentage")
    putouts: Int
    triplePlays: Int @map(name: "triple_plays")
  }

  type BaseballEventState @map(name: "baseball_event_states") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "baseball_event_states_id_seq", initialValue: 1, allocationSize: 1)
    atBatNumber: Int @map(name: "at_bat_number")
    balls: Int
    baseballActionPlays: [BaseballActionPlay]
    baseballActionSubstitutions: [BaseballActionSubstitution]
    batterId: Person @map(name: "batter_id")
    batterSide: String @map(name: "batter_side")
    context: String
    currentState: Int @map(name: "current_state")
    eventId: Event! @map(name: "event_id")
    inningHalf: String @map(name: "inning_half")
    inningValue: Int @map(name: "inning_value")
    outs: Int
    pitcherId: Person @map(name: "pitcher_id")
    runnerOnFirst: Int @map(name: "runner_on_first")
    runnerOnFirstId: Person @map(name: "runner_on_first_id")
    runnerOnSecond: Int @map(name: "runner_on_second")
    runnerOnSecondId: Person @map(name: "runner_on_second_id")
    runnerOnThird: Int @map(name: "runner_on_third")
    runnerOnThirdId: Person @map(name: "runner_on_third_id")
    runsThisInningHalf: Int @map(name: "runs_this_inning_half")
    sequenceNumber: Int @map(name: "sequence_number")
    strikes: Int
  }

  type BaseballOffensiveStat @map(name: "baseball_offensive_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "baseball_offensive_stats_id_seq", initialValue: 1, allocationSize: 1)
    atBats: Int @map(name: "at_bats")
    atBatsPerHomeRun: Float @map(name: "at_bats_per_home_run")
    atBatsPerRbi: Float @map(name: "at_bats_per_rbi")
    average: Float
    basesOnBalls: Int @map(name: "bases_on_balls")
    defensiveInterferanceReaches: Int @map(name: "defensive_interferance_reaches")
    doubles: Int
    grandSlams: Int @map(name: "grand_slams")
    groundedIntoDoublePlay: Int @map(name: "grounded_into_double_play")
    hitByPitch: Int @map(name: "hit_by_pitch")
    hits: Int
    hitsExtraBase: Int @map(name: "hits_extra_base")
    homeRuns: Int @map(name: "home_runs")
    leftInScoringPosition: Int @map(name: "left_in_scoring_position")
    leftOnBase: Int @map(name: "left_on_base")
    movedUp: Int @map(name: "moved_up")
    onBasePercentage: Float @map(name: "on_base_percentage")
    onBasePlusSlugging: Float @map(name: "on_base_plus_slugging")
    plateAppearances: Int @map(name: "plate_appearances")
    plateAppearancesPerHomeRun: Float @map(name: "plate_appearances_per_home_run")
    plateAppearancesPerRbi: Float @map(name: "plate_appearances_per_rbi")
    rbi: Int
    runsScored: Int @map(name: "runs_scored")
    sacBunts: Int @map(name: "sac_bunts")
    sacFlies: Int @map(name: "sac_flies")
    singles: Int
    sluggingPercentage: Float @map(name: "slugging_percentage")
    stolenBases: Int @map(name: "stolen_bases")
    stolenBasesAverage: Float @map(name: "stolen_bases_average")
    stolenBasesCaught: Int @map(name: "stolen_bases_caught")
    strikeouts: Int
    totalBases: Int @map(name: "total_bases")
    triples: Int
  }

  type BaseballPitchingStat @map(name: "baseball_pitching_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "baseball_pitching_stats_id_seq", initialValue: 1, allocationSize: 1)
    balks: Int
    basesOnBalls: Int @map(name: "bases_on_balls")
    basesOnBallsIntentional: Int @map(name: "bases_on_balls_intentional")
    doublesAllowed: Int @map(name: "doubles_allowed")
    earnedRuns: Int @map(name: "earned_runs")
    era: Float
    errorsHitWithPitch: Int @map(name: "errors_hit_with_pitch")
    errorsWildPitch: Int @map(name: "errors_wild_pitch")
    eventCredit: String @map(name: "event_credit")
    gamesComplete: Int @map(name: "games_complete")
    gamesFinished: Int @map(name: "games_finished")
    hits: Int
    homeRunsAllowed: Int @map(name: "home_runs_allowed")
    inheritedRunnersScored: Int @map(name: "inherited_runners_scored")
    inningsPitched: String @map(name: "innings_pitched")
    losses: Int
    numberOfPitches: Int @map(name: "number_of_pitches")
    pickOffs: Int @map(name: "pick_offs")
    runsAllowed: Int @map(name: "runs_allowed")
    saveCredit: String @map(name: "save_credit")
    saves: Int
    shutouts: Int
    singlesAllowed: Int @map(name: "singles_allowed")
    strikeouts: Int
    strikeoutToBbRatio: Float @map(name: "strikeout_to_bb_ratio")
    triplesAllowed: Int @map(name: "triples_allowed")
    unearnedRuns: Int @map(name: "unearned_runs")
    winningPercentage: Float @map(name: "winning_percentage")
    wins: Int
  }

  type BasketballDefensiveStat @map(name: "basketball_defensive_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "basketball_defensive_stats_id_seq", initialValue: 1, allocationSize: 1)
    blocksPerGame: String @map(name: "blocks_per_game")
    blocksTotal: String @map(name: "blocks_total")
    stealsPerGame: String @map(name: "steals_per_game")
    stealsTotal: String @map(name: "steals_total")
  }

  type BasketballEventState @map(name: "basketball_event_states") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "basketball_event_states_id_seq", initialValue: 1, allocationSize: 1)
    context: String
    currentState: Int @map(name: "current_state")
    eventId: Event! @map(name: "event_id")
    periodTimeElapsed: String @map(name: "period_time_elapsed")
    periodTimeRemaining: String @map(name: "period_time_remaining")
    periodValue: String @map(name: "period_value")
    sequenceNumber: Int @map(name: "sequence_number")
  }

  type BasketballOffensiveStat @map(name: "basketball_offensive_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "basketball_offensive_stats_id_seq", initialValue: 1, allocationSize: 1)
    assistsPerGame: String @map(name: "assists_per_game")
    assistsTotal: String @map(name: "assists_total")
    fieldGoalsAttempted: Int @map(name: "field_goals_attempted")
    fieldGoalsAttemptedPerGame: String @map(name: "field_goals_attempted_per_game")
    fieldGoalsMade: Int @map(name: "field_goals_made")
    fieldGoalsPercentage: String @map(name: "field_goals_percentage")
    fieldGoalsPercentageAdjusted: String @map(name: "field_goals_percentage_adjusted")
    fieldGoalsPerGame: String @map(name: "field_goals_per_game")
    freeThrowsAttempted: String @map(name: "free_throws_attempted")
    freeThrowsAttemptedPerGame: String @map(name: "free_throws_attempted_per_game")
    freeThrowsMade: String @map(name: "free_throws_made")
    freeThrowsPercentage: String @map(name: "free_throws_percentage")
    freeThrowsPerGame: String @map(name: "free_throws_per_game")
    pointsScoredInPaint: String @map(name: "points_scored_in_paint")
    pointsScoredOffTurnovers: String @map(name: "points_scored_off_turnovers")
    pointsScoredOnFastBreak: String @map(name: "points_scored_on_fast_break")
    pointsScoredOnSecondChance: String @map(name: "points_scored_on_second_chance")
    pointsScoredPerGame: String @map(name: "points_scored_per_game")
    pointsScoredTotal: String @map(name: "points_scored_total")
    threePointersAttempted: Int @map(name: "three_pointers_attempted")
    threePointersAttemptedPerGame: String @map(name: "three_pointers_attempted_per_game")
    threePointersMade: Int @map(name: "three_pointers_made")
    threePointersPercentage: String @map(name: "three_pointers_percentage")
    threePointersPerGame: String @map(name: "three_pointers_per_game")
    turnoversPerGame: String @map(name: "turnovers_per_game")
    turnoversTotal: String @map(name: "turnovers_total")
  }

  type BasketballReboundingStat @map(name: "basketball_rebounding_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "basketball_rebounding_stats_id_seq", initialValue: 1, allocationSize: 1)
    reboundsDefensive: String @map(name: "rebounds_defensive")
    reboundsOffensive: String @map(name: "rebounds_offensive")
    reboundsPerGame: String @map(name: "rebounds_per_game")
    reboundsTotal: String @map(name: "rebounds_total")
    teamReboundsDefensive: String @map(name: "team_rebounds_defensive")
    teamReboundsOffensive: String @map(name: "team_rebounds_offensive")
    teamReboundsPerGame: String @map(name: "team_rebounds_per_game")
    teamReboundsTotal: String @map(name: "team_rebounds_total")
  }

  type BasketballTeamStat @map(name: "basketball_team_stats") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "basketball_team_stats_id_seq", initialValue: 1, allocationSize: 1)
    foulsTotal: String @map(name: "fouls_total")
    largestLead: String @map(name: "largest_lead")
    timeoutsLeft: String @map(name: "timeouts_left")
    turnoverMargin: String @map(name: "turnover_margin")
  }

  type Bookmaker @map(name: "bookmakers") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "bookmakers_id_seq", initialValue: 1, allocationSize: 1)
    bookmakerKey: String @map(name: "bookmaker_key")
    locationId: Location @map(name: "location_id")
    publisherId: Publisher! @map(name: "publisher_id")
    wageringMoneylines: [WageringMoneyline]
    wageringOddsLines: [WageringOddsLine]
    wageringRunlines: [WageringRunline]
    wageringStraightSpreadLines: [WageringStraightSpreadLine]
    wageringTotalScoreLines: [WageringTotalScoreLine]
  }

  type CorePersonStat @map(name: "core_person_stats") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "core_person_stats_id_seq", initialValue: 1, allocationSize: 1)
    eventsPlayed: Int @map(name: "events_played")
    eventsStarted: Int @map(name: "events_started")
    positionId: Position @map(name: "position_id")
    timePlayedEvent: String @map(name: "time_played_event")
    timePlayedEventAverage: String @map(name: "time_played_event_average")
    timePlayedTotal: String @map(name: "time_played_total")
  }

  type CoreStat @map(name: "core_stats") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "core_stats_id_seq", initialValue: 1, allocationSize: 1)
    score: String
    scoreAttempts: String @map(name: "score_attempts")
    scoreAttemptsOpposing: String @map(name: "score_attempts_opposing")
    scoreOpposing: String @map(name: "score_opposing")
    scorePercentage: String @map(name: "score_percentage")
    scorePercentageOpposing: String @map(name: "score_percentage_opposing")
  }

  type DbInfo @map(name: "db_info") {
    version: String! @default(value: "16")
  }

  type DisplayName @map(name: "display_names") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "display_names_id_seq", initialValue: 1, allocationSize: 1)
    abbreviation: String
    alias: String
    entityId: Int! @map(name: "entity_id")
    entityType: String! @map(name: "entity_type")
    firstName: String @map(name: "first_name")
    fullName: String @map(name: "full_name")
    language: String!
    lastName: String @map(name: "last_name")
    middleName: String @map(name: "middle_name")
    prefix: String
    shortName: String @map(name: "short_name")
    suffix: String
  }

  type Document @map(name: "documents") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "documents_id_seq", initialValue: 1, allocationSize: 1)
    affiliationsDocuments: [AffiliationsDocument]
    dateTime: DateTime @map(name: "date_time")
    dbLoadingDateTime: DateTime @map(name: "db_loading_date_time")
    docId: String! @map(name: "doc_id")
    documentContents: [DocumentContent]
    documentFixtureId: DocumentFixture! @map(name: "document_fixture_id")
    documentFixturesEvents: [DocumentFixturesEvent]
    documentPackageEntry: [DocumentPackageEntry]
    documentsMedia: [DocumentsMedia]
    eventsDocuments: [EventsDocument]
    language: String
    latestRevisions: [LatestRevision]
    personsDocuments: [PersonsDocument]
    priority: String
    publisherId: Publisher! @map(name: "publisher_id")
    revisionId: String @map(name: "revision_id")
    sourceId: Publisher @map(name: "source_id")
    statsCoverage: String @map(name: "stats_coverage")
    teamsDocuments: [TeamsDocument]
    title: String
  }

  type DocumentClass @map(name: "document_classes") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "document_classes_id_seq", initialValue: 1, allocationSize: 1)
    documentFixtures: [DocumentFixture]
    name: String
  }

  type DocumentContent @map(name: "document_contents") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "document_contents_id_seq", initialValue: 1, allocationSize: 1)
    abstract: String
    documentId: Document! @map(name: "document_id")
    sportsml: String
  }

  type DocumentFixture @map(name: "document_fixtures") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "document_fixtures_id_seq", initialValue: 1, allocationSize: 1)
    documentClassId: DocumentClass! @map(name: "document_class_id")
    documentFixturesEvents: [DocumentFixturesEvent]
    documents: [Document]
    fixtureKey: String @map(name: "fixture_key")
    name: String
    publisherId: Publisher! @map(name: "publisher_id")
  }

  type DocumentFixturesEvent @map(name: "document_fixtures_events") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "document_fixtures_events_id_seq", initialValue: 1, allocationSize: 1)
    documentFixtureId: DocumentFixture! @map(name: "document_fixture_id")
    eventId: Event! @map(name: "event_id")
    lastUpdate: DateTime @map(name: "last_update")
    latestDocumentId: Document! @map(name: "latest_document_id")
  }

  type DocumentPackage @map(name: "document_packages") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "document_packages_id_seq", initialValue: 1, allocationSize: 1)
    dateTime: DateTime @map(name: "date_time")
    documentPackageEntry: [DocumentPackageEntry]
    packageKey: String @map(name: "package_key")
    packageName: String @map(name: "package_name")
  }

  type DocumentPackageEntry @map(name: "document_package_entry") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "document_package_entry_id_seq", initialValue: 1, allocationSize: 1)
    documentId: Document! @map(name: "document_id")
    documentPackageId: DocumentPackage! @map(name: "document_package_id")
    headline: String
    rank: String
    shortHeadline: String @map(name: "short_headline")
  }

  type DocumentsMedia @map(name: "documents_media") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "documents_media_id_seq", initialValue: 1, allocationSize: 1)
    documentId: Document! @map(name: "document_id")
    mediaCaptionId: MediaCaption! @map(name: "media_caption_id")
    mediaId: Media! @map(name: "media_id")
  }

  type Event @map(name: "events") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "events_id_seq", initialValue: 1, allocationSize: 1)
    affiliationsEvents: [AffiliationsEvent]
    americanFootballEventStates: [AmericanFootballEventState]
    attendance: String
    baseballEventStates: [BaseballEventState]
    basketballEventStates: [BasketballEventState]
    documentFixturesEvents: [DocumentFixturesEvent]
    duration: String
    eventKey: String! @map(name: "event_key")
    eventsDocuments: [EventsDocument]
    eventsMedia: [EventsMedia]
    eventsSubSeasons: [EventsSubSeason]
    eventStatus: String @map(name: "event_status")
    iceHockeyEventStates: [IceHockeyEventState]
    lastUpdate: DateTime @map(name: "last_update")
    motorRacingEventStates: [MotorRacingEventState]
    participantsEvents: [ParticipantsEvent]
    personEventMetadata: [PersonEventMetadatum]
    publisherId: Publisher! @map(name: "publisher_id")
    siteAlignment: String @map(name: "site_alignment")
    siteId: Site @map(name: "site_id")
    soccerEventStates: [SoccerEventState]
    startDateTime: DateTime @map(name: "start_date_time")
    tennisEventStates: [TennisEventState]
    wageringMoneylines: [WageringMoneyline]
    wageringOddsLines: [WageringOddsLine]
    wageringRunlines: [WageringRunline]
    wageringStraightSpreadLines: [WageringStraightSpreadLine]
    wageringTotalScoreLines: [WageringTotalScoreLine]
    weatherConditions: [WeatherCondition]
  }

  type EventsDocument @map(name: "events_documents") @linkTable {
    documentId: Document! @map(name: "document_id")
    eventId: Event! @map(name: "event_id")
  }

  type EventsMedia @map(name: "events_media") @linkTable {
    eventId: Event! @map(name: "event_id")
    mediaId: Media! @map(name: "media_id")
  }

  type EventsSubSeason @map(name: "events_sub_seasons") @linkTable {
    eventId: Event! @map(name: "event_id")
    subSeasonId: SubSeason! @map(name: "sub_season_id")
  }

  type IceHockeyActionParticipant @map(name: "ice_hockey_action_participants") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "ice_hockey_action_participants_id_seq", initialValue: 1, allocationSize: 1)
    iceHockeyActionPlayId: Int! @map(name: "ice_hockey_action_play_id")
    participantRole: String! @map(name: "participant_role")
    personId: Int! @map(name: "person_id")
    pointCredit: Int @map(name: "point_credit")
  }

  type IceHockeyActionPlay @map(name: "ice_hockey_action_plays") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "ice_hockey_action_plays_id_seq", initialValue: 1, allocationSize: 1)
    comment: String
    iceHockeyEventStateId: Int! @map(name: "ice_hockey_event_state_id")
    playResult: String @map(name: "play_result")
    playType: String @map(name: "play_type")
    scoreAttemptType: String @map(name: "score_attempt_type")
  }

  type IceHockeyDefensiveStat @map(name: "ice_hockey_defensive_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "ice_hockey_defensive_stats_id_seq", initialValue: 1, allocationSize: 1)
    goalsAgainstAverage: String @map(name: "goals_against_average")
    goalsEmptyNetAllowed: String @map(name: "goals_empty_net_allowed")
    goalsPenaltyShotAllowed: String @map(name: "goals_penalty_shot_allowed")
    goalsPowerPlayAllowed: String @map(name: "goals_power_play_allowed")
    goalsShootoutAllowed: String @map(name: "goals_shootout_allowed")
    goalsShortHandedAllowed: String @map(name: "goals_short_handed_allowed")
    hits: String
    minutesPenaltyKilling: String @map(name: "minutes_penalty_killing")
    penaltyKillingAmount: String @map(name: "penalty_killing_amount")
    penaltyKillingPercentage: String @map(name: "penalty_killing_percentage")
    savePercentage: String @map(name: "save_percentage")
    saves: String
    shotsBlocked: String @map(name: "shots_blocked")
    shotsPenaltyShotAllowed: String @map(name: "shots_penalty_shot_allowed")
    shotsPowerPlayAllowed: String @map(name: "shots_power_play_allowed")
    shotsShootoutAllowed: String @map(name: "shots_shootout_allowed")
    shutouts: String
    takeaways: String
  }

  type IceHockeyEventState @map(name: "ice_hockey_event_states") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "ice_hockey_event_states_id_seq", initialValue: 1, allocationSize: 1)
    context: String
    currentState: Int @map(name: "current_state")
    eventId: Event! @map(name: "event_id")
    periodTimeElapsed: String @map(name: "period_time_elapsed")
    periodTimeRemaining: String @map(name: "period_time_remaining")
    periodValue: String @map(name: "period_value")
    sequenceNumber: Int @map(name: "sequence_number")
  }

  type IceHockeyOffensiveStat @map(name: "ice_hockey_offensive_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "ice_hockey_offensive_stats_id_seq", initialValue: 1, allocationSize: 1)
    assists: String
    faceoffLosses: String @map(name: "faceoff_losses")
    faceoffWinPercentage: String @map(name: "faceoff_win_percentage")
    faceoffWins: String @map(name: "faceoff_wins")
    giveaways: String
    goalsEmptyNet: String @map(name: "goals_empty_net")
    goalsEvenStrength: String @map(name: "goals_even_strength")
    goalsGameTying: String @map(name: "goals_game_tying")
    goalsGameWinning: String @map(name: "goals_game_winning")
    goalsOvertime: String @map(name: "goals_overtime")
    goalsPenaltyShot: String @map(name: "goals_penalty_shot")
    goalsPowerPlay: String @map(name: "goals_power_play")
    goalsShootout: String @map(name: "goals_shootout")
    goalsShortHanded: String @map(name: "goals_short_handed")
    minutesPowerPlay: String @map(name: "minutes_power_play")
    points: String
    powerPlayAmount: String @map(name: "power_play_amount")
    powerPlayPercentage: String @map(name: "power_play_percentage")
    scoringChances: String @map(name: "scoring_chances")
    shotsPenaltyShotMissed: String @map(name: "shots_penalty_shot_missed")
    shotsPenaltyShotPercentage: String @map(name: "shots_penalty_shot_percentage")
    shotsPenaltyShotTaken: String @map(name: "shots_penalty_shot_taken")
  }

  type IceHockeyPlayerStat @map(name: "ice_hockey_player_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "ice_hockey_player_stats_id_seq", initialValue: 1, allocationSize: 1)
    plusMinus: String @map(name: "plus_minus")
  }

  type InjuryPhase @map(name: "injury_phases") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "injury_phases_id_seq", initialValue: 1, allocationSize: 1)
    disabledList: String @map(name: "disabled_list")
    endDateTime: DateTime @map(name: "end_date_time")
    injuryComment: String @map(name: "injury_comment")
    injurySide: String @map(name: "injury_side")
    injuryStatus: String @map(name: "injury_status")
    injuryType: String @map(name: "injury_type")
    personId: Person! @map(name: "person_id")
    phaseType: String @map(name: "phase_type")
    seasonId: Season @map(name: "season_id")
    startDateTime: DateTime @map(name: "start_date_time")
  }

  type KeyAlias @map(name: "key_aliases") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "key_aliases_id_seq", initialValue: 1, allocationSize: 1)
    keyId: Int! @map(name: "key_id")
    keyRootId: KeyRoot! @map(name: "key_root_id")
  }

  type KeyRoot @map(name: "key_roots") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "key_roots_id_seq", initialValue: 1, allocationSize: 1)
    keyAliases: [KeyAlias]
    keyType: String @map(name: "key_type")
  }

  type LatestRevision @map(name: "latest_revisions") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "latest_revisions_id_seq", initialValue: 1, allocationSize: 1)
    latestDocumentId: Document! @map(name: "latest_document_id")
    revisionId: String! @map(name: "revision_id")
  }

  type Location @map(name: "locations") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "locations_id_seq", initialValue: 1, allocationSize: 1)
    addresses: [Address]
    bookmakers: [Bookmaker]
    countryCode: String @map(name: "country_code")
    latitude: String
    longitude: String
    media: [Media]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references Person.residenceLocationId.
    # persons: [Person]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references Person.birthLocationId.
    # persons: [Person]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references Person.deathLocationId.
    # persons: [Person]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references Person.hometownLocationId.
    # persons: [Person]
    sites: [Site]
    timezone: String
  }

  type Media @map(name: "media") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "media_id_seq", initialValue: 1, allocationSize: 1)
    affiliationsMedia: [AffiliationsMedia]
    creationLocationId: Location! @map(name: "creation_location_id")
    creditId: Person! @map(name: "credit_id")
    dateTime: String @map(name: "date_time")
    dbLoadingDateTime: DateTime @map(name: "db_loading_date_time")
    documentsMedia: [DocumentsMedia]
    eventsMedia: [EventsMedia]
    mediaCaptions: [MediaCaption]
    mediaContents: [MediaContent]
    mediaKeywords: [MediaKeyword]
    mediaType: String @map(name: "media_type")
    objectId: Int @map(name: "object_id")
    personsMedia: [PersonsMedia]
    publisherId: Publisher! @map(name: "publisher_id")
    revisionId: Int @map(name: "revision_id")
    sourceId: Int @map(name: "source_id")
    teamsMedia: [TeamsMedia]
  }

  type MediaCaption @map(name: "media_captions") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "media_captions_id_seq", initialValue: 1, allocationSize: 1)
    caption: String
    captionAuthorId: Person! @map(name: "caption_author_id")
    captionSize: String @map(name: "caption_size")
    captionType: String @map(name: "caption_type")
    documentsMedia: [DocumentsMedia]
    language: String
    mediaId: Media! @map(name: "media_id")
  }

  type MediaContent @map(name: "media_contents") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "media_contents_id_seq", initialValue: 1, allocationSize: 1)
    duration: String
    fileSize: String @map(name: "file_size")
    format: String
    height: String
    mediaId: Media! @map(name: "media_id")
    mimeType: String @map(name: "mime_type")
    object: String
    resolution: String
    width: String
  }

  type MediaKeyword @map(name: "media_keywords") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "media_keywords_id_seq", initialValue: 1, allocationSize: 1)
    keyword: String
    mediaId: Media! @map(name: "media_id")
  }

  type MotorRacingEventState @map(name: "motor_racing_event_states") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "motor_racing_event_states_id_seq", initialValue: 1, allocationSize: 1)
    context: String
    currentState: Int @map(name: "current_state")
    eventId: Event! @map(name: "event_id")
    flagState: String @map(name: "flag_state")
    lap: String
    lapsRemaining: String @map(name: "laps_remaining")
    sequenceNumber: Int @map(name: "sequence_number")
    timeElapsed: String @map(name: "time_elapsed")
  }

  type MotorRacingQualifyingStat @map(name: "motor_racing_qualifying_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "motor_racing_qualifying_stats_id_seq", initialValue: 1, allocationSize: 1)
    grid: String
    polePosition: String @map(name: "pole_position")
    poleWins: String @map(name: "pole_wins")
    qualifyingPosition: String @map(name: "qualifying_position")
    qualifyingSpeed: String @map(name: "qualifying_speed")
    qualifyingSpeedUnits: String @map(name: "qualifying_speed_units")
    qualifyingTime: String @map(name: "qualifying_time")
  }

  type MotorRacingRaceStat @map(name: "motor_racing_race_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "motor_racing_race_stats_id_seq", initialValue: 1, allocationSize: 1)
    bonus: String
    distanceCompleted: String @map(name: "distance_completed")
    distanceLeading: String @map(name: "distance_leading")
    distanceUnits: String @map(name: "distance_units")
    finishes: String
    finishesTop10: String @map(name: "finishes_top_10")
    finishesTop5: String @map(name: "finishes_top_5")
    lapsAheadFollower: String @map(name: "laps_ahead_follower")
    lapsBehindLeader: String @map(name: "laps_behind_leader")
    lapsCompleted: String @map(name: "laps_completed")
    lapsLeadingTotal: String @map(name: "laps_leading_total")
    leadsTotal: String @map(name: "leads_total")
    money: String
    moneyUnits: String @map(name: "money_units")
    nonFinishes: String @map(name: "non_finishes")
    points: String
    pointsRookie: String @map(name: "points_rookie")
    racesLeading: String @map(name: "races_leading")
    speedAverage: String @map(name: "speed_average")
    speedUnits: String @map(name: "speed_units")
    starts: String
    status: String
    time: String
    timeAheadFollower: String @map(name: "time_ahead_follower")
    timeBehindLeader: String @map(name: "time_behind_leader")
    wins: String
  }

  type OutcomeTotal @map(name: "outcome_totals") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "outcome_totals_id_seq", initialValue: 1, allocationSize: 1)
    losses: String
    outcomeHolderId: Int @map(name: "outcome_holder_id")
    outcomeHolderType: String @map(name: "outcome_holder_type")
    pointsDifference: String @map(name: "points_difference")
    pointsScoredAgainst: String @map(name: "points_scored_against")
    pointsScoredFor: String @map(name: "points_scored_for")
    rank: String
    standingPoints: String @map(name: "standing_points")
    standingSubgroupId: StandingSubgroup! @map(name: "standing_subgroup_id")
    streakDuration: String @map(name: "streak_duration")
    streakEnd: DateTime @map(name: "streak_end")
    streakStart: DateTime @map(name: "streak_start")
    streakTotal: String @map(name: "streak_total")
    streakType: String @map(name: "streak_type")
    ties: String
    undecideds: String
    winningPercentage: String @map(name: "winning_percentage")
    wins: String
  }

  type ParticipantsEvent @map(name: "participants_events") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "participants_events_id_seq", initialValue: 1, allocationSize: 1)
    alignment: String
    eventId: Event! @map(name: "event_id")
    eventOutcome: String @map(name: "event_outcome")
    participantId: Int! @map(name: "participant_id")
    participantType: String! @map(name: "participant_type")
    periods: [Period]
    rank: Int
    score: String
  }

  type Period @map(name: "periods") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "periods_id_seq", initialValue: 1, allocationSize: 1)
    participantEventId: ParticipantsEvent! @map(name: "participant_event_id")
    periodValue: String @map(name: "period_value")
    score: String
    subPeriods: [SubPeriod]
  }

  type Person @map(name: "persons") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "persons_id_seq", initialValue: 1, allocationSize: 1)
    americanFootballActionParticipants: [AmericanFootballActionParticipant]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references BaseballActionSubstitution.personReplacingId.
    # baseballActionSubstitutions: [BaseballActionSubstitution]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references BaseballActionSubstitution.personOriginalId.
    # baseballActionSubstitutions: [BaseballActionSubstitution]
    baseballDefensivePlayers: [BaseballDefensivePlayer]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references BaseballEventState.runnerOnThirdId.
    # baseballEventStates: [BaseballEventState]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references BaseballEventState.runnerOnSecondId.
    # baseballEventStates: [BaseballEventState]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references BaseballEventState.runnerOnFirstId.
    # baseballEventStates: [BaseballEventState]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references BaseballEventState.pitcherId.
    # baseballEventStates: [BaseballEventState]
    baseballEventStates: [BaseballEventState]
    birthDate: String @map(name: "birth_date")
    birthLocationId: Location @map(name: "birth_location_id")
    deathDate: String @map(name: "death_date")
    deathLocationId: Location @map(name: "death_location_id")
    gender: String
    hometownLocationId: Location @map(name: "hometown_location_id")
    injuryPhases: [InjuryPhase]
    media: [Media]
    mediaCaptions: [MediaCaption]
    personEventMetadata: [PersonEventMetadatum]
    personKey: String! @map(name: "person_key")
    personPhases: [PersonPhase]
    personsDocuments: [PersonsDocument]
    personsMedia: [PersonsMedia]
    publisherId: Publisher! @map(name: "publisher_id")
    residenceLocationId: Location @map(name: "residence_location_id")
  }

  type PersonEventMetadatum @map(name: "person_event_metadata") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "person_event_metadata_id_seq", initialValue: 1, allocationSize: 1)
    eventId: Event! @map(name: "event_id")
    health: String
    lineupSlot: Int @map(name: "lineup_slot")
    lineupSlotSequence: Int @map(name: "lineup_slot_sequence")
    personId: Person! @map(name: "person_id")
    positionId: Position @map(name: "position_id")
    roleId: Role @map(name: "role_id")
    status: String
    teamId: Team @map(name: "team_id")
    weight: String
  }

  type PersonPhase @map(name: "person_phases") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "person_phases_id_seq", initialValue: 1, allocationSize: 1)
    endDateTime: DateTime @map(name: "end_date_time")
    endSeasonId: Season @map(name: "end_season_id")
    entryReason: String @map(name: "entry_reason")
    exitReason: String @map(name: "exit_reason")
    height: String
    membershipId: Int! @map(name: "membership_id")
    membershipType: String! @map(name: "membership_type")
    personId: Person! @map(name: "person_id")
    phaseStatus: String @map(name: "phase_status")
    regularPositionDepth: String @map(name: "regular_position_depth")
    regularPositionId: Position @map(name: "regular_position_id")
    roleId: Role @map(name: "role_id")
    roleStatus: String @map(name: "role_status")
    selectionLevel: Int @map(name: "selection_level")
    selectionOverall: Int @map(name: "selection_overall")
    selectionSublevel: Int @map(name: "selection_sublevel")
    startDateTime: DateTime @map(name: "start_date_time")
    startSeasonId: Season @map(name: "start_season_id")
    uniformNumber: String @map(name: "uniform_number")
    weight: String
  }

  type PersonsDocument @map(name: "persons_documents") @linkTable {
    documentId: Document! @map(name: "document_id")
    personId: Person! @map(name: "person_id")
  }

  type PersonsMedia @map(name: "persons_media") @linkTable {
    mediaId: Media! @map(name: "media_id")
    personId: Person! @map(name: "person_id")
  }

  type Position @map(name: "positions") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "positions_id_seq", initialValue: 1, allocationSize: 1)
    abbreviation: String!
    affiliationId: Affiliation! @map(name: "affiliation_id")
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references BaseballActionSubstitution.personOriginalPositionId.
    # baseballActionSubstitutions: [BaseballActionSubstitution]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references BaseballActionSubstitution.personReplacingPositionId.
    # baseballActionSubstitutions: [BaseballActionSubstitution]
    baseballDefensivePlayers: [BaseballDefensivePlayer]
    corePersonStats: [CorePersonStat]
    personEventMetadata: [PersonEventMetadatum]
    personPhases: [PersonPhase]
  }

  type Publisher @map(name: "publishers") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "publishers_id_seq", initialValue: 1, allocationSize: 1)
    affiliations: [Affiliation]
    bookmakers: [Bookmaker]
    documentFixtures: [DocumentFixture]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references Document.sourceId.
    # documents: [Document]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references Document.publisherId.
    # documents: [Document]
    events: [Event]
    media: [Media]
    persons: [Person]
    publisherKey: String! @map(name: "publisher_key")
    publisherName: String @map(name: "publisher_name")
    seasons: [Season]
    sites: [Site]
    standings: [Standing]
    teams: [Team]
  }

  type Role @map(name: "roles") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "roles_id_seq", initialValue: 1, allocationSize: 1)
    comment: String
    personEventMetadata: [PersonEventMetadatum]
    personPhases: [PersonPhase]
    roleKey: String! @map(name: "role_key")
    roleName: String @map(name: "role_name")
    teamPhases: [TeamPhase]
  }

  type Season @map(name: "seasons") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "seasons_id_seq", initialValue: 1, allocationSize: 1)
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references AffiliationPhase.endSeasonId.
    # affiliationPhases: [AffiliationPhase]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references AffiliationPhase.startSeasonId.
    # affiliationPhases: [AffiliationPhase]
    endDateTime: DateTime @map(name: "end_date_time")
    injuryPhases: [InjuryPhase]
    leagueId: Affiliation! @map(name: "league_id")
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references PersonPhase.endSeasonId.
    # personPhases: [PersonPhase]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references PersonPhase.startSeasonId.
    # personPhases: [PersonPhase]
    publisherId: Publisher! @map(name: "publisher_id")
    seasonKey: Int! @map(name: "season_key")
    startDateTime: DateTime @map(name: "start_date_time")
    subSeasons: [SubSeason]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references TeamPhase.endSeasonId.
    # teamPhases: [TeamPhase]
    # Could not auto-generate backwards relation field, name would be ambigous.
    # Please specify the name of this field and the name of the relation manually.
    # It references TeamPhase.startSeasonId.
    # teamPhases: [TeamPhase]
  }

  type Site @map(name: "sites") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "sites_id_seq", initialValue: 1, allocationSize: 1)
    events: [Event]
    locationId: Location @map(name: "location_id")
    publisherId: Publisher! @map(name: "publisher_id")
    siteKey: Int! @map(name: "site_key")
    teams: [Team]
  }

  type SoccerDefensiveStat @map(name: "soccer_defensive_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "soccer_defensive_stats_id_seq", initialValue: 1, allocationSize: 1)
    catchesPunches: String @map(name: "catches_punches")
    goalsAgainstAverage: String @map(name: "goals_against_average")
    goalsAgainstTotal: String @map(name: "goals_against_total")
    goalsPenaltyShotAllowed: String @map(name: "goals_penalty_shot_allowed")
    savePercentage: String @map(name: "save_percentage")
    saves: String
    shotsBlocked: String @map(name: "shots_blocked")
    shotsOnGoalTotal: String @map(name: "shots_on_goal_total")
    shotsPenaltyShotAllowed: String @map(name: "shots_penalty_shot_allowed")
    shotsShootoutAllowed: String @map(name: "shots_shootout_allowed")
    shotsShootoutTotal: String @map(name: "shots_shootout_total")
    shutouts: String
  }

  type SoccerEventState @map(name: "soccer_event_states") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "soccer_event_states_id_seq", initialValue: 1, allocationSize: 1)
    context: String
    currentState: Int @map(name: "current_state")
    eventId: Event! @map(name: "event_id")
    minutesElapsed: String @map(name: "minutes_elapsed")
    periodMinuteElapsed: String @map(name: "period_minute_elapsed")
    periodTimeElapsed: String @map(name: "period_time_elapsed")
    periodTimeRemaining: String @map(name: "period_time_remaining")
    periodValue: String @map(name: "period_value")
    sequenceNumber: Int @map(name: "sequence_number")
  }

  type SoccerFoulStat @map(name: "soccer_foul_stats") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "soccer_foul_stats_id_seq", initialValue: 1, allocationSize: 1)
    cautionPointsPending: String @map(name: "caution_points_pending")
    cautionPointsTotal: String @map(name: "caution_points_total")
    cautionsPending: String @map(name: "cautions_pending")
    cautionsTotal: String @map(name: "cautions_total")
    ejectionsTotal: String @map(name: "ejections_total")
    foulsCommited: String @map(name: "fouls_commited")
    foulsSuffered: String @map(name: "fouls_suffered")
  }

  type SoccerOffensiveStat @map(name: "soccer_offensive_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "soccer_offensive_stats_id_seq", initialValue: 1, allocationSize: 1)
    assistsGameTying: String @map(name: "assists_game_tying")
    assistsGameWinning: String @map(name: "assists_game_winning")
    assistsOvertime: String @map(name: "assists_overtime")
    assistsTotal: String @map(name: "assists_total")
    cornerKicks: String @map(name: "corner_kicks")
    giveaways: String
    goalsGameTying: String @map(name: "goals_game_tying")
    goalsGameWinning: String @map(name: "goals_game_winning")
    goalsOvertime: String @map(name: "goals_overtime")
    goalsShootout: String @map(name: "goals_shootout")
    goalsTotal: String @map(name: "goals_total")
    hatTricks: String @map(name: "hat_tricks")
    offsides: String
    points: String
    shotsHitFrame: String @map(name: "shots_hit_frame")
    shotsOnGoalTotal: String @map(name: "shots_on_goal_total")
    shotsPenaltyShotMissed: String @map(name: "shots_penalty_shot_missed")
    shotsPenaltyShotPercentage: String @map(name: "shots_penalty_shot_percentage")
    shotsPenaltyShotScored: String @map(name: "shots_penalty_shot_scored")
    shotsPenaltyShotTaken: String @map(name: "shots_penalty_shot_taken")
    shotsShootoutMissed: String @map(name: "shots_shootout_missed")
    shotsShootoutPercentage: String @map(name: "shots_shootout_percentage")
    shotsShootoutScored: String @map(name: "shots_shootout_scored")
    shotsShootoutTaken: String @map(name: "shots_shootout_taken")
    shotsTotal: String @map(name: "shots_total")
  }

  type Standing @map(name: "standings") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "standings_id_seq", initialValue: 1, allocationSize: 1)
    affiliationId: Affiliation! @map(name: "affiliation_id")
    alignmentScope: String @map(name: "alignment_scope")
    competitionScope: String @map(name: "competition_scope")
    competitionScopeId: String @map(name: "competition_scope_id")
    durationScope: String @map(name: "duration_scope")
    lastUpdated: String @map(name: "last_updated")
    publisherId: Publisher! @map(name: "publisher_id")
    scopingLabel: String @map(name: "scoping_label")
    siteScope: String @map(name: "site_scope")
    source: String
    standingSubgroups: [StandingSubgroup]
    standingType: String @map(name: "standing_type")
    subSeasonId: SubSeason! @map(name: "sub_season_id")
  }

  type StandingSubgroup @map(name: "standing_subgroups") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "standing_subgroups_id_seq", initialValue: 1, allocationSize: 1)
    affiliationId: Affiliation! @map(name: "affiliation_id")
    outcomeTotals: [OutcomeTotal]
    standingId: Standing! @map(name: "standing_id")
  }

  type Stat @map(name: "stats") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "stats_id_seq", initialValue: 1, allocationSize: 1)
    context: String!
    statCoverageId: Int @map(name: "stat_coverage_id")
    statCoverageType: String @map(name: "stat_coverage_type")
    statHolderId: Int @map(name: "stat_holder_id")
    statHolderType: String @map(name: "stat_holder_type")
    statRepositoryId: Int! @map(name: "stat_repository_id")
    statRepositoryType: String @map(name: "stat_repository_type")
  }

  type SubPeriod @map(name: "sub_periods") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "sub_periods_id_seq", initialValue: 1, allocationSize: 1)
    periodId: Period! @map(name: "period_id")
    score: String
    subPeriodValue: String @map(name: "sub_period_value")
  }

  type SubSeason @map(name: "sub_seasons") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "sub_seasons_id_seq", initialValue: 1, allocationSize: 1)
    endDateTime: DateTime @map(name: "end_date_time")
    eventsSubSeasons: [EventsSubSeason]
    seasonId: Season! @map(name: "season_id")
    standings: [Standing]
    startDateTime: DateTime @map(name: "start_date_time")
    subSeasonKey: String! @map(name: "sub_season_key")
    subSeasonType: String! @map(name: "sub_season_type")
  }

  type Team @map(name: "teams") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "teams_id_seq", initialValue: 1, allocationSize: 1)
    americanFootballEventStates: [AmericanFootballEventState]
    homeSiteId: Site @map(name: "home_site_id")
    personEventMetadata: [PersonEventMetadatum]
    publisherId: Publisher! @map(name: "publisher_id")
    teamKey: String! @map(name: "team_key")
    teamPhases: [TeamPhase]
    teamsDocuments: [TeamsDocument]
    teamsMedia: [TeamsMedia]
    wageringMoneylines: [WageringMoneyline]
    wageringOddsLines: [WageringOddsLine]
    wageringRunlines: [WageringRunline]
    wageringStraightSpreadLines: [WageringStraightSpreadLine]
    wageringTotalScoreLines: [WageringTotalScoreLine]
  }

  type TeamAmericanFootballStat @map(name: "team_american_football_stats") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "team_american_football_stats_id_seq", initialValue: 1, allocationSize: 1)
    averageStartingPosition: String @map(name: "average_starting_position")
    timeOfPossession: String @map(name: "time_of_possession")
    timeouts: String
    turnoverRatio: String @map(name: "turnover_ratio")
    yardsPerAttempt: String @map(name: "yards_per_attempt")
  }

  type TeamPhase @map(name: "team_phases") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "team_phases_id_seq", initialValue: 1, allocationSize: 1)
    affiliationId: Affiliation! @map(name: "affiliation_id")
    endDateTime: String @map(name: "end_date_time")
    endSeasonId: Season @map(name: "end_season_id")
    phaseStatus: String @map(name: "phase_status")
    roleId: Role @map(name: "role_id")
    startDateTime: String @map(name: "start_date_time")
    startSeasonId: Season @map(name: "start_season_id")
    teamId: Team! @map(name: "team_id")
  }

  type TeamsDocument @map(name: "teams_documents") @linkTable {
    documentId: Document! @map(name: "document_id")
    teamId: Team! @map(name: "team_id")
  }

  type TeamsMedia @map(name: "teams_media") @linkTable {
    mediaId: Media! @map(name: "media_id")
    teamId: Team! @map(name: "team_id")
  }

  type TennisActionPoint @map(name: "tennis_action_points") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "tennis_action_points_id_seq", initialValue: 1, allocationSize: 1)
    sequenceNumber: String @map(name: "sequence_number")
    subPeriodId: String @map(name: "sub_period_id")
    winType: String @map(name: "win_type")
  }

  type TennisActionVolley @map(name: "tennis_action_volleys") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "tennis_action_volleys_id_seq", initialValue: 1, allocationSize: 1)
    landingLocation: String @map(name: "landing_location")
    result: String
    sequenceNumber: String @map(name: "sequence_number")
    spinType: String @map(name: "spin_type")
    swingType: String @map(name: "swing_type")
    tennisActionPointsId: Int @map(name: "tennis_action_points_id")
    trajectoryDetails: String @map(name: "trajectory_details")
  }

  type TennisEventState @map(name: "tennis_event_states") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "tennis_event_states_id_seq", initialValue: 1, allocationSize: 1)
    context: String
    currentState: Int @map(name: "current_state")
    eventId: Event! @map(name: "event_id")
    game: String
    receiverPersonId: Int @map(name: "receiver_person_id")
    receiverScore: String @map(name: "receiver_score")
    sequenceNumber: Int @map(name: "sequence_number")
    serverPersonId: Int @map(name: "server_person_id")
    serverScore: String @map(name: "server_score")
    serviceNumber: String @map(name: "service_number")
    tennisSet: String @map(name: "tennis_set")
  }

  type TennisReturnStat @map(name: "tennis_return_stats") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "tennis_return_stats_id_seq", initialValue: 1, allocationSize: 1)
    breakPointsConverted: String @map(name: "break_points_converted")
    breakPointsConvertedPct: String @map(name: "break_points_converted_pct")
    breakPointsPlayed: String @map(name: "break_points_played")
    firstServiceReturnPointsWon: String @map(name: "first_service_return_points_won")
    firstServiceReturnPointsWonPct: String @map(name: "first_service_return_points_won_pct")
    matchesPlayed: String @map(name: "matches_played")
    returnGamesPlayed: String @map(name: "return_games_played")
    returnGamesWon: String @map(name: "return_games_won")
    returnGamesWonPct: String @map(name: "return_games_won_pct")
    returnsPlayed: String @map(name: "returns_played")
    secondServiceReturnPointsWon: String @map(name: "second_service_return_points_won")
    secondServiceReturnPointsWonPct: String @map(name: "second_service_return_points_won_pct")
  }

  type TennisServiceStat @map(name: "tennis_service_stats") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "tennis_service_stats_id_seq", initialValue: 1, allocationSize: 1)
    aces: String
    breakPointsPlayed: String @map(name: "break_points_played")
    breakPointsSaved: String @map(name: "break_points_saved")
    breakPointsSavedPct: String @map(name: "break_points_saved_pct")
    firstServicePointsWon: String @map(name: "first_service_points_won")
    firstServicePointsWonPct: String @map(name: "first_service_points_won_pct")
    firstServicesGood: String @map(name: "first_services_good")
    firstServicesGoodPct: String @map(name: "first_services_good_pct")
    matchesPlayed: String @map(name: "matches_played")
    secondServicePointsWon: String @map(name: "second_service_points_won")
    secondServicePointsWonPct: String @map(name: "second_service_points_won_pct")
    serviceGamesPlayed: String @map(name: "service_games_played")
    serviceGamesWon: String @map(name: "service_games_won")
    serviceGamesWonPct: String @map(name: "service_games_won_pct")
    servicesPlayed: String @map(name: "services_played")
  }

  type WageringMoneyline @map(name: "wagering_moneylines") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "wagering_moneylines_id_seq", initialValue: 1, allocationSize: 1)
    bookmakerId: Bookmaker! @map(name: "bookmaker_id")
    comment: String
    dateTime: DateTime @map(name: "date_time")
    eventId: Event! @map(name: "event_id")
    line: String
    lineOpening: String @map(name: "line_opening")
    personId: Int @map(name: "person_id")
    prediction: String
    rotationKey: String @map(name: "rotation_key")
    teamId: Team! @map(name: "team_id")
    vigorish: String
  }

  type WageringOddsLine @map(name: "wagering_odds_lines") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "wagering_odds_lines_id_seq", initialValue: 1, allocationSize: 1)
    bookmakerId: Bookmaker! @map(name: "bookmaker_id")
    comment: String
    dateTime: DateTime @map(name: "date_time")
    denominator: String
    eventId: Event! @map(name: "event_id")
    numerator: String
    payoutAmount: String @map(name: "payout_amount")
    payoutCalculation: String @map(name: "payout_calculation")
    personId: Int @map(name: "person_id")
    prediction: String
    rotationKey: String @map(name: "rotation_key")
    teamId: Team! @map(name: "team_id")
  }

  type WageringRunline @map(name: "wagering_runlines") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "wagering_runlines_id_seq", initialValue: 1, allocationSize: 1)
    bookmakerId: Bookmaker! @map(name: "bookmaker_id")
    comment: String
    dateTime: DateTime @map(name: "date_time")
    eventId: Event! @map(name: "event_id")
    line: String
    lineOpening: String @map(name: "line_opening")
    lineValue: String @map(name: "line_value")
    personId: Int @map(name: "person_id")
    prediction: String
    rotationKey: String @map(name: "rotation_key")
    teamId: Team! @map(name: "team_id")
    vigorish: String
  }

  type WageringStraightSpreadLine @map(name: "wagering_straight_spread_lines") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "wagering_straight_spread_lines_id_seq", initialValue: 1, allocationSize: 1)
    bookmakerId: Bookmaker! @map(name: "bookmaker_id")
    comment: String
    dateTime: DateTime @map(name: "date_time")
    eventId: Event! @map(name: "event_id")
    lineValue: String @map(name: "line_value")
    lineValueOpening: String @map(name: "line_value_opening")
    personId: Int @map(name: "person_id")
    prediction: String
    rotationKey: String @map(name: "rotation_key")
    teamId: Team! @map(name: "team_id")
    vigorish: String
  }

  type WageringTotalScoreLine @map(name: "wagering_total_score_lines") {
    id: Int!
      @id(strategy: SEQUENCE)
      @sequence(name: "wagering_total_score_lines_id_seq", initialValue: 1, allocationSize: 1)
    bookmakerId: Bookmaker! @map(name: "bookmaker_id")
    comment: String
    dateTime: DateTime @map(name: "date_time")
    eventId: Event! @map(name: "event_id")
    lineOver: String @map(name: "line_over")
    lineUnder: String @map(name: "line_under")
    personId: Int @map(name: "person_id")
    prediction: String
    rotationKey: String @map(name: "rotation_key")
    teamId: Team! @map(name: "team_id")
    total: String
    totalOpening: String @map(name: "total_opening")
    vigorish: String
  }

  type WeatherCondition @map(name: "weather_conditions") {
    id: Int! @id(strategy: SEQUENCE) @sequence(name: "weather_conditions_id_seq", initialValue: 1, allocationSize: 1)
    clouds: String
    eventId: Event! @map(name: "event_id")
    humidity: String
    temperature: String
    temperatureUnits: String @map(name: "temperature_units")
    weatherCode: String @map(name: "weather_code")
    windDirection: String @map(name: "wind_direction")
    windVelocity: String @map(name: "wind_velocity")
  }
`
