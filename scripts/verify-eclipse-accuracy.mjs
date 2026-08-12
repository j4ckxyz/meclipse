import reference from './eclipse-reference-data.json' with { type: 'json' }
import { findUpcomingEclipse } from '../src/lib/eclipse.ts'

const quiet = process.argv.includes('--quiet')
const json = process.argv.includes('--json')
const results = []

function localSeconds(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return Number(values.hour) * 3600 + Number(values.minute) * 60 + Number(values.second)
}

function expectedSeconds(clock) {
  const [hour, minute] = clock.split(':').map(Number)
  return hour * 3600 + minute * 60
}

function circularTimeDifference(actual, expected) {
  const difference = Math.abs(actual - expected)
  return Math.min(difference, 86_400 - difference)
}

function compareTime(location, field, actualDate) {
  const expected = location[field]
  if (!expected) return null
  if (!actualDate) {
    return { metric: field, passed: false, error: Infinity, message: `${field} is missing` }
  }
  const error = circularTimeDifference(localSeconds(actualDate, location.timeZone), expectedSeconds(expected))
  const tolerance = location.horizonSensitive
    ? reference.thresholds.horizonContactTimeSeconds
    : reference.thresholds.contactTimeSeconds
  return {
    metric: field,
    passed: error <= tolerance,
    error,
    message: `${field} ${new Intl.DateTimeFormat('en-GB', { timeZone: location.timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(actualDate)} vs ${expected}`,
  }
}

for (const location of reference.locations) {
  const calculated = findUpcomingEclipse(
    { latitude: location.latitude, longitude: location.longitude },
    new Date(reference.comparisonStart),
  )
  const checks = []

  checks.push({
    metric: 'event',
    passed: calculated !== null,
    error: calculated ? 0 : Infinity,
    message: calculated ? 'event found' : 'no eclipse returned',
  })

  if (calculated) {
    checks.push({
      metric: 'kind',
      passed: calculated.kind === location.kind,
      error: calculated.kind === location.kind ? 0 : 1,
      message: `kind ${calculated.kind} vs ${location.kind}`,
    })

    if (typeof location.coverage === 'number') {
      const actualCoverage = calculated.coverage * 100
      const error = Math.abs(actualCoverage - location.coverage)
      const tolerance = location.horizonSensitive
        ? reference.thresholds.horizonCoveragePercentagePoints
        : reference.thresholds.coveragePercentagePoints
      checks.push({
        metric: 'coverage',
        passed: error <= tolerance,
        error,
        message: `coverage ${actualCoverage.toFixed(2)}% vs ${location.coverage.toFixed(1)}%`,
      })
    }

    for (const [field, actual] of [
      ['begins', calculated.begins],
      ['peak', calculated.peak],
      ['totalBegins', calculated.totalBegins],
      ['totalEnds', calculated.totalEnds],
      ['ends', calculated.ends],
    ]) {
      const comparison = compareTime(location, field, actual)
      if (comparison) checks.push(comparison)
    }
  }

  results.push({
    name: location.name,
    source: location.source,
    passed: checks.every((check) => check.passed),
    horizonSensitive: Boolean(location.horizonSensitive),
    checks,
  })
}

const failures = results.filter((result) => !result.passed)
const coverageChecks = results.flatMap((result) => result.checks).filter((check) => check.metric === 'coverage')
const timeChecks = results.flatMap((result) => result.checks).filter((check) => ['begins', 'peak', 'totalBegins', 'totalEnds', 'ends'].includes(check.metric))
const ordinaryCoverageChecks = results.filter((result) => !result.horizonSensitive).flatMap((result) => result.checks).filter((check) => check.metric === 'coverage')
const ordinaryTimeChecks = results.filter((result) => !result.horizonSensitive).flatMap((result) => result.checks).filter((check) => ['begins', 'peak', 'totalBegins', 'totalEnds', 'ends'].includes(check.metric))
const summary = {
  event: reference.event,
  locations: results.length,
  checks: results.reduce((total, result) => total + result.checks.length, 0),
  failures: failures.length,
  horizonSensitiveLocations: results.filter((result) => result.horizonSensitive).length,
  maximumCoverageErrorPercentagePoints: Math.max(...coverageChecks.map((check) => check.error)),
  meanCoverageErrorPercentagePoints: coverageChecks.reduce((total, check) => total + check.error, 0) / coverageChecks.length,
  maximumContactTimeErrorSeconds: Math.max(...timeChecks.map((check) => check.error)),
  meanContactTimeErrorSeconds: timeChecks.reduce((total, check) => total + check.error, 0) / timeChecks.length,
  ordinaryMaximumCoverageErrorPercentagePoints: Math.max(...ordinaryCoverageChecks.map((check) => check.error)),
  ordinaryMeanCoverageErrorPercentagePoints: ordinaryCoverageChecks.reduce((total, check) => total + check.error, 0) / ordinaryCoverageChecks.length,
  ordinaryMaximumContactTimeErrorSeconds: Math.max(...ordinaryTimeChecks.map((check) => check.error)),
  ordinaryMeanContactTimeErrorSeconds: ordinaryTimeChecks.reduce((total, check) => total + check.error, 0) / ordinaryTimeChecks.length,
  sources: Object.values(reference.sources).map(({ name, url }) => ({ name, url })),
}

if (json) {
  console.log(JSON.stringify({ summary, results }, null, 2))
} else {
  console.log(`\nMeclipse published-data accuracy check — ${reference.event}`)
  console.log(`Compared ${summary.locations} city centres across ${summary.checks} assertions.`)
  console.log(`Ordinary coverage error: mean ${summary.ordinaryMeanCoverageErrorPercentagePoints.toFixed(2)} pp · max ${summary.ordinaryMaximumCoverageErrorPercentagePoints.toFixed(2)} pp`)
  console.log(`Ordinary contact-time error: mean ${summary.ordinaryMeanContactTimeErrorSeconds.toFixed(0)} s · max ${summary.ordinaryMaximumContactTimeErrorSeconds.toFixed(0)} s`)
  console.log(`Horizon-sensitive cases: ${summary.horizonSensitiveLocations} (wider tolerance for local refraction and terrain).`)
  console.log(`All-case raw maxima: ${summary.maximumCoverageErrorPercentagePoints.toFixed(2)} pp coverage · ${summary.maximumContactTimeErrorSeconds.toFixed(0)} s contact time.`)
  if (!quiet || failures.length) {
    for (const result of results) {
      const marker = result.passed ? 'PASS' : 'FAIL'
      const detail = result.checks.filter((check) => !check.passed).map((check) => check.message).join('; ')
      console.log(`${marker.padEnd(4)}  ${result.name}${detail ? ` — ${detail}` : ''}`)
    }
  }
  console.log(`\n${failures.length ? `${failures.length} location(s) exceeded tolerance.` : 'All published-data comparisons passed.'}`)
}

if (failures.length) process.exitCode = 1
