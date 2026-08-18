import { sign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const requiredEnvironment = [
  'APP_STORE_CONNECT_API_ISSUER_ID',
  'APP_STORE_CONNECT_API_KEY_ID',
  'APP_STORE_CONNECT_API_KEY_PATH',
  'APP_STORE_CONNECT_APP_ID',
  'APP_STORE_CONNECT_BETA_GROUP_ID',
  'APP_STORE_CONNECT_BUILD_NUMBER',
]

const missingEnvironment = requiredEnvironment.filter(
  (name) => !process.env[name],
)
if (missingEnvironment.length > 0) {
  throw new Error(
    `Missing environment variables: ${missingEnvironment.join(', ')}`,
  )
}

const apiBase = 'https://api.appstoreconnect.apple.com'
const issuerId = process.env.APP_STORE_CONNECT_API_ISSUER_ID
const keyId = process.env.APP_STORE_CONNECT_API_KEY_ID
const privateKey = readFileSync(
  process.env.APP_STORE_CONNECT_API_KEY_PATH,
  'utf8',
)
const appId = process.env.APP_STORE_CONNECT_APP_ID
const betaGroupId = process.env.APP_STORE_CONNECT_BETA_GROUP_ID
const buildNumber = process.env.APP_STORE_CONNECT_BUILD_NUMBER
const dryRun = process.argv.includes('--dry-run')
const maxAttempts = Number(process.env.APP_STORE_CONNECT_MAX_ATTEMPTS || 40)
const pollIntervalMs = Number(
  process.env.APP_STORE_CONNECT_POLL_INTERVAL_MS || 30_000,
)

const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url')
const sleep = (duration) =>
  new Promise((resolve) => setTimeout(resolve, duration))

const createToken = () => {
  const now = Math.floor(Date.now() / 1000)
  const unsignedToken = `${encode({ alg: 'ES256', kid: keyId, typ: 'JWT' })}.${encode(
    {
      aud: 'appstoreconnect-v1',
      exp: now + 1_200,
      iat: now,
      iss: issuerId,
    },
  )}`
  const signature = sign('sha256', Buffer.from(unsignedToken), {
    dsaEncoding: 'ieee-p1363',
    key: privateKey,
  }).toString('base64url')

  return `${unsignedToken}.${signature}`
}

const request = async (path, { body, method = 'GET' } = {}) => {
  const response = await fetch(new URL(path, apiBase), {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      Authorization: `Bearer ${createToken()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    method,
  })
  const responseText = await response.text()
  const payload = responseText ? JSON.parse(responseText) : null

  if (!response.ok) {
    const details = payload?.errors
      ?.map(
        (error) =>
          `${error.code || error.status}: ${error.detail || error.title}`,
      )
      .join('; ')
    throw new Error(
      `${method} ${path} returned ${response.status}${details ? `: ${details}` : ''}`,
    )
  }

  return payload
}

const findProcessedBuild = async () => {
  const query = new URLSearchParams({
    'filter[app]': appId,
    'filter[version]': buildNumber,
    limit: '1',
    sort: '-uploadedDate',
  })

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const payload = await request(`/v1/builds?${query}`)
    const build = payload.data[0]

    if (!build) {
      console.log(
        `Build ${buildNumber} is not visible yet (${attempt}/${maxAttempts})`,
      )
    } else {
      const processingState = build.attributes.processingState
      console.log(`Build ${buildNumber} processing state: ${processingState}`)

      if (processingState === 'VALID') return build
      if (['FAILED', 'INVALID'].includes(processingState)) {
        throw new Error(
          `Build ${buildNumber} processing ended in ${processingState}`,
        )
      }
    }

    if (attempt < maxAttempts) await sleep(pollIntervalMs)
  }

  throw new Error(
    `Build ${buildNumber} did not become valid within the polling window`,
  )
}

const associateBuild = async (buildId) => {
  const relationshipPath = `/v1/betaGroups/${betaGroupId}/relationships/builds`
  const relationships = await request(`${relationshipPath}?limit=200`)
  const alreadyAssociated = relationships.data.some(
    (build) => build.id === buildId,
  )

  if (alreadyAssociated) {
    console.log(
      `Build ${buildNumber} is already associated with beta group ${betaGroupId}`,
    )
    return
  }

  if (dryRun) {
    console.log(
      `Dry run: build ${buildNumber} would be associated with beta group ${betaGroupId}`,
    )
    return
  }

  await request(relationshipPath, {
    body: { data: [{ id: buildId, type: 'builds' }] },
    method: 'POST',
  })
  console.log(`Associated build ${buildNumber} with beta group ${betaGroupId}`)
}

const waitForInternalTesting = async (buildId) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const payload = await request(`/v1/builds/${buildId}/buildBetaDetail`)
    const internalBuildState = payload.data.attributes.internalBuildState
    console.log(`Build ${buildNumber} internal state: ${internalBuildState}`)

    if (internalBuildState === 'IN_BETA_TESTING') return payload.data
    if (['EXPIRED', 'REJECTED'].includes(internalBuildState)) {
      throw new Error(
        `Build ${buildNumber} internal testing ended in ${internalBuildState}`,
      )
    }
    if (dryRun) {
      throw new Error(
        `Dry run found build ${buildNumber} in ${internalBuildState}`,
      )
    }

    if (attempt < maxAttempts) await sleep(pollIntervalMs)
  }

  throw new Error(
    `Build ${buildNumber} did not enter internal testing within the polling window`,
  )
}

const build = await findProcessedBuild()
await associateBuild(build.id)
const betaDetail = await waitForInternalTesting(build.id)

console.log(
  JSON.stringify(
    {
      appId,
      betaGroupId,
      buildId: build.id,
      buildNumber,
      internalBuildState: betaDetail.attributes.internalBuildState,
      processingState: build.attributes.processingState,
    },
    null,
    2,
  ),
)
