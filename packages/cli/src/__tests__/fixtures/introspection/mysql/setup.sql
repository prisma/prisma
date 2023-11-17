DROP TABLE IF EXISTS `your_log`;
CREATE TABLE `your_log` (
  `click_id` int(11) NOT NULL AUTO_INCREMENT,
  `click_time` datetime NOT NULL,
  `shorturl` varchar(200) CHARACTER SET latin1 COLLATE latin1_bin NOT NULL,
  `referrer` varchar(200) COLLATE latin1_german2_ci NOT NULL,
  `user_agent` varchar(255) COLLATE latin1_german2_ci NOT NULL,
  `ip_address` varchar(41) COLLATE latin1_german2_ci NOT NULL,
  `country_code` char(2) COLLATE latin1_german2_ci NOT NULL,
  PRIMARY KEY (`click_id`),
  KEY `shorturl` (`shorturl`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_german2_ci;

DROP TABLE IF EXISTS `your_options`;
CREATE TABLE `your_options` (
  `option_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `option_name` varchar(64) COLLATE latin1_german2_ci NOT NULL DEFAULT '',
  `option_value` longtext COLLATE latin1_german2_ci NOT NULL,
  PRIMARY KEY (`option_id`,`option_name`),
  KEY `option_name` (`option_name`)
) ENGINE=MyISAM AUTO_INCREMENT=5 DEFAULT CHARSET=latin1 COLLATE=latin1_german2_ci;

DROP TABLE IF EXISTS `your_url`;
CREATE TABLE `your_url` (
  `keyword` varchar(200) CHARACTER SET latin1 COLLATE latin1_bin NOT NULL,
  `url` text CHARACTER SET latin1 COLLATE latin1_bin NOT NULL,
  `title` text CHARACTER SET utf8,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip` varchar(41) COLLATE latin1_german2_ci NOT NULL,
  `clicks` int(10) unsigned NOT NULL,
  PRIMARY KEY (`keyword`),
  KEY `timestamp` (`timestamp`),
  KEY `ip` (`ip`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_german2_ci;
