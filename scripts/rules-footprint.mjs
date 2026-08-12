#!/usr/bin/env node
/**
 * Reports footprint metrics for Cursor rules and agent documentation.
 *
 * Usage: node scripts/rules-footprint.mjs [--check]
 *
 * With --check flag: exits with code 1 if any thresholds are exceeded.
 *
 * Outputs:
 *   - total bytes/lines for .cursor/rules/**
 *   - bytes/lines for alwaysApply: true rulecards only
 *   - bytes/lines for AGENTS.md
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const RULES_DIR = '.cursor/rules';
const AGENTS_FILE = 'AGENTS.md';
const CONFIG_FILE = '.cursor/rules-footprint.config.json';

const DEFAULT_THRESHOLDS = {
  alwaysApplyLines: 500,
  alwaysApplyBytes: 20_000,
  agentsLines: 200,
  agentsBytes: 10_000,
  totalRulesLines: 5_000,
  totalRulesBytes: 200_000,
};

function loadThresholds() {
  if (!existsSync(CONFIG_FILE)) {
    console.warn(`Warning: ${CONFIG_FILE} not found, using defaults`);
    return DEFAULT_THRESHOLDS;
  }

  try {
    const raw = readFileSync(CONFIG_FILE, 'utf8');
    const config = JSON.parse(raw);

    if (!config.thresholds || typeof config.thresholds !== 'object') {
      console.warn(`Warning: ${CONFIG_FILE} missing 'thresholds' object, using defaults`);
      return DEFAULT_THRESHOLDS;
    }

    return { ...DEFAULT_THRESHOLDS, ...config.thresholds };
  } catch (err) {
    console.warn(`Warning: Failed to parse ${CONFIG_FILE}: ${err.message}, using defaults`);
    return DEFAULT_THRESHOLDS;
  }
}

function countLines(content) {
  return content.split(/\r?\n/).length;
}

function extractFrontmatter(content) {
  try {
    const parsed = matter(content);
    return parsed.data && Object.keys(parsed.data).length > 0 ? parsed.data : null;
  } catch {
    return null;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scanRulecardFiles(dir) {
  const files = readdirSync(dir).filter((f) => /\.(md|mdc)$/i.test(f) && !/^README\.md$/i.test(f));

  let totalBytes = 0;
  let totalLines = 0;
  let alwaysApplyBytes = 0;
  let alwaysApplyLines = 0;
  const alwaysApplyFiles = [];
  const allRuleStats = [];

  for (const file of files) {
    const full = join(dir, file);
    const content = readFileSync(full, 'utf8');
    const stats = statSync(full);
    const lines = countLines(content);
    const bytes = stats.size;

    totalBytes += bytes;
    totalLines += lines;

    const fm = extractFrontmatter(content);
    const isAlwaysApply = fm?.alwaysApply === true;

    allRuleStats.push({
      file,
      lines,
      bytes,
      alwaysApply: isAlwaysApply,
    });

    if (isAlwaysApply) {
      alwaysApplyBytes += bytes;
      alwaysApplyLines += lines;
      alwaysApplyFiles.push({ file, lines, bytes });
    }
  }

  // README.md in rules dir (add to total but not counted as a rulecard)
  try {
    const readmeContent = readFileSync(join(dir, 'README.md'), 'utf8');
    const readmeStats = statSync(join(dir, 'README.md'));
    totalBytes += readmeStats.size;
    totalLines += countLines(readmeContent);
  } catch {
    // README.md not found, ignore
  }

  return {
    files,
    allRuleStats,
    totalBytes,
    totalLines,
    alwaysApplyFiles,
    alwaysApplyBytes,
    alwaysApplyLines,
  };
}

function readAgentsStats(file) {
  try {
    const content = readFileSync(file, 'utf8');
    const stats = statSync(file);
    return {
      agentsBytes: stats.size,
      agentsLines: countLines(content),
    };
  } catch {
    console.warn(`Warning: ${file} not found`);
    return { agentsBytes: 0, agentsLines: 0 };
  }
}

function printReport(stats) {
  const {
    files,
    totalBytes,
    totalLines,
    alwaysApplyFiles,
    alwaysApplyBytes,
    alwaysApplyLines,
    agentsBytes,
    agentsLines,
  } = stats;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    RULES FOOTPRINT REPORT                     ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  console.log('📁 Total .cursor/rules/**');
  console.log(`   Files: ${files.length} rulecards + README`);
  console.log(`   Lines: ${totalLines.toLocaleString()}`);
  console.log(`   Bytes: ${formatBytes(totalBytes)}`);
  console.log();

  console.log('⚡ alwaysApply: true (loaded on every prompt)');
  console.log(`   Files: ${alwaysApplyFiles.length}`);
  console.log(`   Lines: ${alwaysApplyLines.toLocaleString()}`);
  console.log(`   Bytes: ${formatBytes(alwaysApplyBytes)}`);
  if (alwaysApplyFiles.length > 0) {
    console.log('   Breakdown:');
    for (const { file, lines, bytes } of alwaysApplyFiles.sort((a, b) => b.lines - a.lines)) {
      console.log(`     - ${file}: ${lines} lines (${formatBytes(bytes)})`);
    }
  }
  console.log();

  console.log('📄 AGENTS.md');
  console.log(`   Lines: ${agentsLines.toLocaleString()}`);
  console.log(`   Bytes: ${formatBytes(agentsBytes)}`);
  console.log();

  console.log('📊 Combined always-loaded context');
  const combinedLines = alwaysApplyLines + agentsLines;
  const combinedBytes = alwaysApplyBytes + agentsBytes;
  console.log(`   Lines: ${combinedLines.toLocaleString()}`);
  console.log(`   Bytes: ${formatBytes(combinedBytes)}`);
  console.log();
}

function checkThresholds(stats, thresholds, checkMode) {
  if (!checkMode) return;

  const { totalBytes, totalLines, alwaysApplyBytes, alwaysApplyLines, agentsBytes, agentsLines } =
    stats;

  const violations = [];

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                      THRESHOLD CHECK                          ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log();

  if (alwaysApplyLines > thresholds.alwaysApplyLines) {
    violations.push(`alwaysApply lines: ${alwaysApplyLines} > ${thresholds.alwaysApplyLines}`);
  }
  if (alwaysApplyBytes > thresholds.alwaysApplyBytes) {
    violations.push(
      `alwaysApply bytes: ${formatBytes(alwaysApplyBytes)} > ${formatBytes(thresholds.alwaysApplyBytes)}`,
    );
  }
  if (agentsLines > thresholds.agentsLines) {
    violations.push(`AGENTS.md lines: ${agentsLines} > ${thresholds.agentsLines}`);
  }
  if (agentsBytes > thresholds.agentsBytes) {
    violations.push(
      `AGENTS.md bytes: ${formatBytes(agentsBytes)} > ${formatBytes(thresholds.agentsBytes)}`,
    );
  }
  if (totalLines > thresholds.totalRulesLines) {
    violations.push(`Total rules lines: ${totalLines} > ${thresholds.totalRulesLines}`);
  }
  if (totalBytes > thresholds.totalRulesBytes) {
    violations.push(
      `Total rules bytes: ${formatBytes(totalBytes)} > ${formatBytes(thresholds.totalRulesBytes)}`,
    );
  }

  if (violations.length > 0) {
    console.log('❌ THRESHOLDS EXCEEDED:');
    for (const v of violations) {
      console.log(`   - ${v}`);
    }
    console.log();
    console.log('Adjust thresholds in .cursor/rules-footprint.config.json if intentional.');
    process.exit(1);
  } else {
    console.log('✅ All thresholds passed');
  }
  console.log();
}

function printThresholds(thresholds) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    CURRENT THRESHOLDS                         ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   alwaysApply lines: ${thresholds.alwaysApplyLines.toLocaleString()}`);
  console.log(`   alwaysApply bytes: ${formatBytes(thresholds.alwaysApplyBytes)}`);
  console.log(`   AGENTS.md lines:   ${thresholds.agentsLines.toLocaleString()}`);
  console.log(`   AGENTS.md bytes:   ${formatBytes(thresholds.agentsBytes)}`);
  console.log(`   Total rules lines: ${thresholds.totalRulesLines.toLocaleString()}`);
  console.log(`   Total rules bytes: ${formatBytes(thresholds.totalRulesBytes)}`);
  console.log();
}

function main() {
  const checkMode = process.argv.includes('--check');
  const thresholds = loadThresholds();

  const ruleStats = scanRulecardFiles(RULES_DIR);
  const agentsStats = readAgentsStats(AGENTS_FILE);

  const stats = { ...ruleStats, ...agentsStats };

  printReport(stats);
  checkThresholds(stats, thresholds, checkMode);
  printThresholds(thresholds);
}

main();
