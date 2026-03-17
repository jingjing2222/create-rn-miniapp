import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { CliPrompter } from '../../cli.js'
import {
  buildFirebaseCommand,
  buildFirebaseFunctionsDeployCommand,
  ensureFirebaseBuildServiceAccountPermissions,
  ensureFirebaseFirestoreReady,
  ensureFirebaseProjectIsOnBlazePlan,
  finalizeFirebaseProvisioning,
  formatFirebaseAddFirebaseFailureMessage,
  formatFirebaseBlazeUpgradeMessage,
  formatFirebaseFunctionsDeployFailureMessage,
  formatFirebaseManualSetupNote,
  isFirebaseBillingEnabled,
  isGoogleCloudAuthRefreshError,
  isFirebaseProjectAddFirebaseRecoveryError,
  isFirebaseAddFirebasePermissionDeniedError,
  isFirebaseFunctionsBuildServiceAccountPermissionError,
  isFirebaseProjectIdConflictError,
  resolveGoogleCloudCliArchiveSpec,
  writeFirebaseLocalEnvFiles,
  writeFirebaseServerLocalEnvFile,
} from './provision.js'

test('buildFirebaseCommand uses package-manager execution commands for all supported managers', () => {
  assert.deepEqual(buildFirebaseCommand('pnpm', '/tmp/ebook', 'Firebase 테스트', ['login']), {
    cwd: '/tmp/ebook',
    command: 'pnpm',
    args: ['dlx', 'firebase-tools', 'login'],
    label: 'Firebase 테스트',
  })

  assert.deepEqual(buildFirebaseCommand('yarn', '/tmp/ebook', 'Firebase 테스트', ['login']), {
    cwd: '/tmp/ebook',
    command: 'yarn',
    args: ['dlx', 'firebase-tools', 'login'],
    label: 'Firebase 테스트',
  })

  assert.deepEqual(buildFirebaseCommand('npm', '/tmp/ebook', 'Firebase 테스트', ['login']), {
    cwd: '/tmp/ebook',
    command: 'npx',
    args: ['firebase-tools', 'login'],
    label: 'Firebase 테스트',
  })

  assert.deepEqual(buildFirebaseCommand('bun', '/tmp/ebook', 'Firebase 테스트', ['login']), {
    cwd: '/tmp/ebook',
    command: 'bunx',
    args: ['firebase-tools', 'login'],
    label: 'Firebase 테스트',
  })
})

test('buildFirebaseFunctionsDeployCommand deploys functions and firestore resources together', () => {
  assert.deepEqual(
    buildFirebaseFunctionsDeployCommand('yarn', '/tmp/ebook/server', 'ebook-firebase'),
    {
      cwd: '/tmp/ebook/server',
      command: 'yarn',
      args: [
        'dlx',
        'firebase-tools',
        'deploy',
        '--only',
        'functions,firestore:rules,firestore:indexes',
        '--config',
        'firebase.json',
        '--project',
        'ebook-firebase',
      ],
      label: 'Firebase Functions 배포',
    },
  )
})

test('resolveGoogleCloudCliArchiveSpec picks the correct official archive per platform', () => {
  assert.deepEqual(resolveGoogleCloudCliArchiveSpec('darwin', 'arm64'), {
    fileName: 'google-cloud-cli-darwin-arm.tar.gz',
    url: 'https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-darwin-arm.tar.gz',
  })
  assert.deepEqual(resolveGoogleCloudCliArchiveSpec('darwin', 'x64'), {
    fileName: 'google-cloud-cli-darwin-x86_64.tar.gz',
    url: 'https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-darwin-x86_64.tar.gz',
  })
  assert.deepEqual(resolveGoogleCloudCliArchiveSpec('linux', 'x64'), {
    fileName: 'google-cloud-cli-linux-x86_64.tar.gz',
    url: 'https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz',
  })
})

test('isFirebaseProjectIdConflictError detects duplicate Firebase project ID failures', () => {
  assert.equal(
    isFirebaseProjectIdConflictError(
      'Error: Failed to create project because there is already a project with ID test-test. Please try again with a unique project ID.',
    ),
    true,
  )
  assert.equal(
    isFirebaseProjectIdConflictError(
      'Error: Failed to create project because billing is disabled.',
    ),
    false,
  )
  assert.equal(
    isFirebaseProjectIdConflictError(
      [
        'Firebase 새 프로젝트 생성 단계가 실패했습니다. (yarn dlx firebase-tools projects:create test-test --display-name test)',
        'Error: Failed to create project because there is already a project with ID test-test. Please try again with a unique project ID.',
      ].join('\n'),
    ),
    true,
  )
})

test('isFirebaseProjectAddFirebaseRecoveryError detects partial firebase project creation failures', () => {
  assert.equal(
    isFirebaseProjectAddFirebaseRecoveryError(
      [
        'Firebase 새 프로젝트 생성 단계가 실패했습니다. (yarn dlx firebase-tools projects:create test-test-jingjing --display-name test)',
        '- Creating Google Cloud Platform project',
        '✔ Creating Google Cloud Platform project',
        '- Adding Firebase resources to Google Cloud Platform project',
        '✖ Adding Firebase resources to Google Cloud Platform project',
      ].join('\n'),
    ),
    true,
  )
  assert.equal(
    isFirebaseProjectAddFirebaseRecoveryError(
      'Firebase 새 프로젝트 생성 단계가 실패했습니다. billing account is required.',
    ),
    false,
  )
})

test('isFirebaseAddFirebasePermissionDeniedError detects addFirebase 403 failures from debug logs', () => {
  assert.equal(
    isFirebaseAddFirebasePermissionDeniedError(
      [
        '[debug] POST https://firebase.googleapis.com/v1beta1/projects/test:addFirebase 403',
        '[debug] {"error":{"code":403,"message":"The caller does not have permission","status":"PERMISSION_DENIED"}}',
      ].join('\n'),
    ),
    true,
  )
  assert.equal(
    isFirebaseAddFirebasePermissionDeniedError(
      'Failed to add Firebase because billing is disabled.',
    ),
    false,
  )
})

test('formatFirebaseAddFirebaseFailureMessage explains permission-denied failures', () => {
  const message = formatFirebaseAddFirebaseFailureMessage({
    projectId: 'test-test-jingjing-app',
    cwd: '/tmp/ebook',
    rawMessage: 'Error: Failed to add Firebase to Google Cloud Platform project.',
    debugLogContent: [
      '[debug] POST https://firebase.googleapis.com/v1beta1/projects/test-test-jingjing-app:addFirebase 403',
      '[debug] {"error":{"code":403,"message":"The caller does not have permission","status":"PERMISSION_DENIED"}}',
    ].join('\n'),
  })

  assert.match(message, /Firebase 리소스를 붙이는 중에 실패했어요/)
  assert.match(message, /PERMISSION_DENIED/)
  assert.match(message, /Firebase Terms of Service/)
  assert.match(message, /Owner 또는 Editor/)
  assert.match(message, /firebase-debug\.log/)
  assert.match(message, /projects:addfirebase test-test-jingjing-app/)
})

test('isFirebaseBillingEnabled reflects gcloud billingEnabled state', () => {
  assert.equal(isFirebaseBillingEnabled({ billingEnabled: true }), true)
  assert.equal(isFirebaseBillingEnabled({ billingEnabled: false }), false)
  assert.equal(isFirebaseBillingEnabled({}), false)
})

test('formatFirebaseBlazeUpgradeMessage includes billing URLs and project context', () => {
  const message = formatFirebaseBlazeUpgradeMessage({
    projectId: 'miniapp-8000b',
    billingInfo: {
      name: 'projects/miniapp-8000b/billingInfo',
      projectId: 'miniapp-8000b',
      billingAccountName: '',
      billingEnabled: false,
    },
  })

  assert.match(message, /Blaze 플랜/)
  assert.match(
    message,
    /console\.cloud\.google\.com\/billing\/linkedaccount\?project=miniapp-8000b/,
  )
  assert.match(message, /firebase\.google\.com\/pricing/)
  assert.match(message, /billingEnabled=false/)
})

test('isGoogleCloudAuthRefreshError detects invalid_grant and auth login prompts', () => {
  assert.equal(
    isGoogleCloudAuthRefreshError(
      [
        "ERROR: (gcloud.billing.projects.describe) There was a problem refreshing your current auth tokens: ('invalid_grant: Bad Request', {'error': 'invalid_grant'})",
        'Please run:',
        '  $ gcloud auth login',
      ].join('\n'),
    ),
    true,
  )
  assert.equal(isGoogleCloudAuthRefreshError('billing account is disabled'), false)
})

test('ensureFirebaseProjectIsOnBlazePlan retries until billing is enabled', async () => {
  const actions: string[] = []
  let attempt = 0

  const prompt: CliPrompter = {
    async text() {
      throw new Error('text should not be called')
    },
    async select<T extends string>() {
      actions.push('retry')
      return '__firebase_blaze_retry__' as T
    },
  }

  await ensureFirebaseProjectIsOnBlazePlan({
    cwd: '/tmp/ebook',
    projectId: 'miniapp-8000b',
    prompt,
    ensureGcloudInstalled: async () => 'gcloud',
    describeBillingInfo: async () => {
      attempt += 1
      return attempt === 1 ? { billingEnabled: false } : { billingEnabled: true }
    },
    logMessage: () => {},
  })

  assert.equal(attempt, 2)
  assert.deepEqual(actions, ['retry'])
})

test('ensureFirebaseProjectIsOnBlazePlan refreshes gcloud auth on invalid_grant before billing retry', async () => {
  const actions: string[] = []
  let attempt = 0

  const prompt: CliPrompter = {
    async text() {
      throw new Error('text should not be called')
    },
    async select<T extends string>() {
      actions.push('retry')
      return '__firebase_blaze_retry__' as T
    },
  }

  await ensureFirebaseProjectIsOnBlazePlan({
    cwd: '/tmp/ebook',
    projectId: 'miniapp-8000b',
    prompt,
    ensureGcloudInstalled: async () => '/tmp/google-cloud-sdk/bin/gcloud',
    ensureGcloudAuth: async () => {
      actions.push('auth')
    },
    describeBillingInfo: async () => {
      attempt += 1

      if (attempt === 1) {
        throw new Error(
          [
            "ERROR: (gcloud.billing.projects.describe) There was a problem refreshing your current auth tokens: ('invalid_grant: Bad Request', {'error': 'invalid_grant'})",
            'Please run:',
            '  $ gcloud auth login',
          ].join('\n'),
        )
      }

      return attempt === 2 ? { billingEnabled: false } : { billingEnabled: true }
    },
    logMessage: () => {},
  })

  assert.equal(attempt, 3)
  assert.deepEqual(actions, ['auth', 'retry'])
})

test('ensureFirebaseProjectIsOnBlazePlan stops when user cancels Blaze upgrade loop', async () => {
  const prompt: CliPrompter = {
    async text() {
      throw new Error('text should not be called')
    },
    async select<T extends string>() {
      return '__firebase_blaze_cancel__' as T
    },
  }

  await assert.rejects(
    ensureFirebaseProjectIsOnBlazePlan({
      cwd: '/tmp/ebook',
      projectId: 'miniapp-8000b',
      prompt,
      ensureGcloudInstalled: async () => 'gcloud',
      describeBillingInfo: async () => ({ billingEnabled: false }),
      logMessage: () => {},
    }),
    /Blaze 플랜이 필요합니다/,
  )
})

test('ensureFirebaseBuildServiceAccountPermissions grants missing IAM roles to the actual Cloud Build default service account', async () => {
  const actions: string[] = []
  let policyAttempt = 0

  await ensureFirebaseBuildServiceAccountPermissions({
    cwd: '/tmp/ebook',
    projectId: 'miniapp-8000b',
    ensureGcloudInstalled: async () => '/tmp/google-cloud-sdk/bin/gcloud',
    getDefaultBuildServiceAccount: async () => '563134134914@cloudbuild.gserviceaccount.com',
    ensureBuildServiceAccountExists: async () => true,
    getProjectIamPolicy: async () => {
      policyAttempt += 1

      if (policyAttempt === 1) {
        return {
          bindings: [],
        }
      }

      return {
        bindings: [
          {
            role: 'roles/cloudbuild.builds.builder',
            members: ['serviceAccount:563134134914@cloudbuild.gserviceaccount.com'],
          },
          {
            role: 'roles/run.builder',
            members: ['serviceAccount:563134134914@cloudbuild.gserviceaccount.com'],
          },
        ],
      }
    },
    addProjectIamBinding: async (_cwd, _projectId, member, role) => {
      actions.push(`${member}:${role}`)
    },
  })

  assert.equal(policyAttempt, 2)
  assert.deepEqual(actions, [
    'serviceAccount:563134134914@cloudbuild.gserviceaccount.com:roles/cloudbuild.builds.builder',
    'serviceAccount:563134134914@cloudbuild.gserviceaccount.com:roles/run.builder',
  ])
})

test('ensureFirebaseBuildServiceAccountPermissions refreshes gcloud auth before retrying IAM inspection', async () => {
  const actions: string[] = []
  let policyAttempt = 0

  await ensureFirebaseBuildServiceAccountPermissions({
    cwd: '/tmp/ebook',
    projectId: 'miniapp-8000b',
    ensureGcloudInstalled: async () => '/tmp/google-cloud-sdk/bin/gcloud',
    ensureGcloudAuth: async () => {
      actions.push('auth')
    },
    getDefaultBuildServiceAccount: async () => '563134134914@cloudbuild.gserviceaccount.com',
    ensureBuildServiceAccountExists: async () => true,
    getProjectIamPolicy: async () => {
      policyAttempt += 1

      if (policyAttempt === 1) {
        throw new Error(
          [
            "ERROR: (gcloud.projects.get-iam-policy) There was a problem refreshing your current auth tokens: ('invalid_grant: Bad Request', {'error': 'invalid_grant'})",
            'Please run:',
            '  $ gcloud auth login',
          ].join('\n'),
        )
      }

      return {
        bindings: [
          {
            role: 'roles/cloudbuild.builds.builder',
            members: ['serviceAccount:563134134914@cloudbuild.gserviceaccount.com'],
          },
          {
            role: 'roles/run.builder',
            members: ['serviceAccount:563134134914@cloudbuild.gserviceaccount.com'],
          },
        ],
      }
    },
    addProjectIamBinding: async () => {
      throw new Error('addProjectIamBinding should not be called')
    },
  })

  assert.equal(policyAttempt, 2)
  assert.deepEqual(actions, ['auth'])
})

test('ensureFirebaseBuildServiceAccountPermissions enables Cloud Build API and retries when default service account lookup reports SERVICE_DISABLED', async () => {
  const actions: string[] = []
  let defaultServiceAccountAttempt = 0

  await ensureFirebaseBuildServiceAccountPermissions({
    cwd: '/tmp/ebook',
    projectId: 'miniapp-8000b',
    ensureGcloudInstalled: async () => '/tmp/google-cloud-sdk/bin/gcloud',
    getDefaultBuildServiceAccount: async () => {
      defaultServiceAccountAttempt += 1

      if (defaultServiceAccountAttempt === 1) {
        throw new Error(
          [
            'ERROR: (gcloud.builds.get-default-service-account) PERMISSION_DENIED: Cloud Build API has not been used in project miniapp-8000b before or it is disabled.',
            'reason: SERVICE_DISABLED',
            'service: cloudbuild.googleapis.com',
          ].join('\n'),
        )
      }

      return '563134134914@cloudbuild.gserviceaccount.com'
    },
    enableGoogleCloudServices: async (_cwd, _projectId, services) => {
      actions.push(`enable:${services.join(',')}`)
    },
    ensureBuildServiceAccountExists: async () => true,
    getProjectIamPolicy: async () => ({
      bindings: [
        {
          role: 'roles/cloudbuild.builds.builder',
          members: ['serviceAccount:563134134914@cloudbuild.gserviceaccount.com'],
        },
        {
          role: 'roles/run.builder',
          members: ['serviceAccount:563134134914@cloudbuild.gserviceaccount.com'],
        },
      ],
    }),
    addProjectIamBinding: async () => {
      throw new Error('addProjectIamBinding should not be called')
    },
  })

  assert.equal(defaultServiceAccountAttempt, 2)
  assert.deepEqual(actions, ['enable:cloudbuild.googleapis.com'])
})

test('ensureFirebaseBuildServiceAccountPermissions stops with a clear error when the detected build service account does not exist', async () => {
  await assert.rejects(
    ensureFirebaseBuildServiceAccountPermissions({
      cwd: '/tmp/ebook',
      projectId: 'miniapp-8000b',
      ensureGcloudInstalled: async () => '/tmp/google-cloud-sdk/bin/gcloud',
      getDefaultBuildServiceAccount: async () =>
        '452297252702-compute@developer.gserviceaccount.com',
      ensureBuildServiceAccountExists: async () => false,
      getProjectIamPolicy: async () => {
        throw new Error('getProjectIamPolicy should not be called')
      },
      addProjectIamBinding: async () => {
        throw new Error('addProjectIamBinding should not be called')
      },
    }),
    /Cloud Build 기본 service account .* 존재하지 않습니다/,
  )
})

test('ensureFirebaseBuildServiceAccountPermissions retries build service account checks and shows attempt progress before succeeding', async () => {
  const attempts: string[] = []
  const waits: number[] = []
  let serviceAccountExistsAttempt = 0

  await ensureFirebaseBuildServiceAccountPermissions({
    cwd: '/tmp/ebook',
    projectId: 'miniapp-8000b',
    ensureGcloudInstalled: async () => '/tmp/google-cloud-sdk/bin/gcloud',
    getDefaultBuildServiceAccount: async () => '563134134914@cloudbuild.gserviceaccount.com',
    ensureBuildServiceAccountExists: async () => {
      serviceAccountExistsAttempt += 1
      return serviceAccountExistsAttempt >= 3
    },
    getProjectIamPolicy: async () => ({
      bindings: [
        {
          role: 'roles/cloudbuild.builds.builder',
          members: ['serviceAccount:563134134914@cloudbuild.gserviceaccount.com'],
        },
        {
          role: 'roles/run.builder',
          members: ['serviceAccount:563134134914@cloudbuild.gserviceaccount.com'],
        },
      ],
    }),
    addProjectIamBinding: async () => {
      throw new Error('addProjectIamBinding should not be called')
    },
    logMessage: (message) => {
      attempts.push(message)
    },
    wait: async (ms) => {
      waits.push(ms)
    },
  })

  assert.equal(serviceAccountExistsAttempt, 3)
  assert.deepEqual(waits, [750, 750])
  assert.deepEqual(attempts, [
    'Cloud Build 기본 service account를 확인하는 중이에요. (1/5)',
    'Cloud Build 기본 service account를 확인하는 중이에요. (2/5)',
    'Cloud Build 기본 service account를 확인하는 중이에요. (3/5)',
  ])
})

test('ensureFirebaseBuildServiceAccountPermissions retries build service account checks five times before failing', async () => {
  const attempts: string[] = []
  const waits: number[] = []
  let serviceAccountExistsAttempt = 0

  await assert.rejects(
    ensureFirebaseBuildServiceAccountPermissions({
      cwd: '/tmp/ebook',
      projectId: 'miniapp-8000b',
      ensureGcloudInstalled: async () => '/tmp/google-cloud-sdk/bin/gcloud',
      getDefaultBuildServiceAccount: async () => '563134134914@cloudbuild.gserviceaccount.com',
      ensureBuildServiceAccountExists: async () => {
        serviceAccountExistsAttempt += 1
        return false
      },
      getProjectIamPolicy: async () => {
        throw new Error('getProjectIamPolicy should not be called')
      },
      addProjectIamBinding: async () => {
        throw new Error('addProjectIamBinding should not be called')
      },
      logMessage: (message) => {
        attempts.push(message)
      },
      wait: async (ms) => {
        waits.push(ms)
      },
    }),
    /Cloud Build 기본 service account .* 존재하지 않습니다/,
  )

  assert.equal(serviceAccountExistsAttempt, 5)
  assert.deepEqual(waits, [750, 750, 750, 750])
  assert.deepEqual(attempts, [
    'Cloud Build 기본 service account를 확인하는 중이에요. (1/5)',
    'Cloud Build 기본 service account를 확인하는 중이에요. (2/5)',
    'Cloud Build 기본 service account를 확인하는 중이에요. (3/5)',
    'Cloud Build 기본 service account를 확인하는 중이에요. (4/5)',
    'Cloud Build 기본 service account를 확인하는 중이에요. (5/5)',
  ])
})

test('isFirebaseFunctionsBuildServiceAccountPermissionError detects Cloud Build IAM failures', () => {
  assert.equal(
    isFirebaseFunctionsBuildServiceAccountPermissionError(
      'Build failed with status: FAILURE. Could not build the function due to a missing permission on the build service account.',
    ),
    true,
  )
  assert.equal(
    isFirebaseFunctionsBuildServiceAccountPermissionError(
      'Build failed because billing is disabled.',
    ),
    false,
  )
})

test('ensureFirebaseFirestoreReady enables Firestore API when it is disabled', async () => {
  const actions: string[] = []

  await ensureFirebaseFirestoreReady({
    cwd: '/tmp/ebook',
    projectId: 'ebook-firebase',
    databaseLocation: 'asia-northeast3',
    ensureGcloudInstalled: async () => 'gcloud',
    describeFirestoreDatabase: async () => {
      actions.push('describe')

      if (actions.length === 1) {
        throw new Error(
          'ERROR: (gcloud.firestore.databases.describe) PERMISSION_DENIED: Cloud Firestore API has not been used in project ebook-firebase before or it is disabled.\nreason: SERVICE_DISABLED\nservice: firestore.googleapis.com',
        )
      }

      return {
        name: 'projects/ebook-firebase/databases/(default)',
        locationId: 'asia-northeast3',
      }
    },
    enableGoogleCloudServices: async (_cwd, _projectId, services) => {
      actions.push(`enable:${services.join(',')}`)
    },
    createFirestoreDatabase: async () => {
      actions.push('create')
    },
  })

  assert.deepEqual(actions, ['describe', 'enable:firestore.googleapis.com', 'describe'])
})

test('ensureFirebaseFirestoreReady creates the default Firestore database when it is missing', async () => {
  const actions: string[] = []

  await ensureFirebaseFirestoreReady({
    cwd: '/tmp/ebook',
    projectId: 'ebook-firebase',
    databaseLocation: 'asia-northeast3',
    ensureGcloudInstalled: async () => 'gcloud',
    describeFirestoreDatabase: async () => {
      actions.push('describe')
      throw new Error(
        'ERROR: (gcloud.firestore.databases.describe) NOT_FOUND: Database (default) does not exist for project ebook-firebase.',
      )
    },
    enableGoogleCloudServices: async () => {
      actions.push('enable')
    },
    createFirestoreDatabase: async (_cwd, projectId, location) => {
      actions.push(`create:${projectId}:${location}`)
    },
  })

  assert.deepEqual(actions, ['describe', 'create:ebook-firebase:asia-northeast3'])
})

test('formatFirebaseFunctionsDeployFailureMessage explains build service account IAM failures', () => {
  const message = formatFirebaseFunctionsDeployFailureMessage({
    projectId: 'miniapp-8000b',
    cwd: '/tmp/ebook/server',
    rawMessage:
      'Firebase Functions 배포 단계가 실패했습니다. (yarn dlx firebase-tools deploy --only functions --config firebase.json --project miniapp-8000b)',
    debugLogContent: [
      '[error] Build failed with status: FAILURE. Could not build the function due to a missing permission on the build service account.',
      'If you did not revoke that permission explicitly, this could be caused by a change in the organization policies.',
      'Please refer to the following documentation for more details and resolution: https://cloud.google.com/functions/docs/troubleshooting#build-service-account',
      'You can also view the logs at https://console.cloud.google.com/cloud-build/builds;region=asia-northeast3/d05a1901-b9c8-4eb4-b324-f21d58fc4133?project=874836726388.',
    ].join('\n'),
  })

  assert.match(message, /Firebase Functions 배포 단계가 실패했습니다/)
  assert.match(message, /로컬 Yarn\/PnP 문제가 아니라 Google Cloud IAM/)
  assert.match(message, /roles\/cloudbuild\.builds\.builder/)
  assert.match(message, /Cloud Build 로그/)
  assert.match(message, /cloud-build\/builds;region=asia-northeast3/)
  assert.match(message, /server\/package\.json의 deploy/)
  assert.match(message, /원본 CLI 출력/)
  assert.match(message, /firebase-debug\.log tail/)
  assert.match(message, /missing permission on the build service account/)
})

test('formatFirebaseManualSetupNote includes frontend, backoffice, and server guidance', () => {
  const note = formatFirebaseManualSetupNote({
    targetRoot: '/tmp/ebook-miniapp',
    packageManager: 'bun',
    hasBackoffice: true,
    projectId: 'ebook-firebase',
    functionRegion: 'asia-northeast3',
    hasConfiguredToken: false,
    hasConfiguredCredentials: false,
  })

  assert.equal(note.title, 'Firebase 연결 값을 이렇게 넣어 주세요')
  assert.match(
    note.body,
    /console\.firebase\.google\.com\/project\/ebook-firebase\/settings\/general/,
  )
  assert.match(note.body, /frontend\/\.env\.local/)
  assert.match(note.body, /backoffice\/\.env\.local/)
  assert.match(note.body, /server\/\.env\.local/)
  assert.match(note.body, /MINIAPP_FIREBASE_API_KEY=<Firebase Web API key>/)
  assert.match(note.body, /VITE_FIREBASE_APP_ID=<appId>/)
  assert.match(note.body, /## Firebase deploy auth/)
  assert.match(note.body, /bunx firebase-tools login:ci/)
  assert.match(note.body, /GOOGLE_APPLICATION_CREDENTIALS/)
  assert.match(note.body, /server\/README\.md/)
  assert.doesNotMatch(note.body, /Cloud Functions Developer/)
  assert.doesNotMatch(note.body, /Service Account User/)
})

test('writeFirebaseLocalEnvFiles writes frontend and backoffice .env.local files', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-firebase-'))

  try {
    await writeFirebaseLocalEnvFiles({
      targetRoot,
      hasBackoffice: true,
      functionRegion: 'asia-northeast3',
      config: {
        apiKey: 'api-key',
        authDomain: 'ebook-firebase.firebaseapp.com',
        projectId: 'ebook-firebase',
        storageBucket: 'ebook-firebase.firebasestorage.app',
        messagingSenderId: '1234567890',
        appId: '1:1234567890:web:abc123',
        measurementId: 'G-123456',
      },
    })

    const frontendEnv = await readFile(path.join(targetRoot, 'frontend', '.env.local'), 'utf8')
    const backofficeEnv = await readFile(path.join(targetRoot, 'backoffice', '.env.local'), 'utf8')

    assert.equal(
      frontendEnv,
      [
        'MINIAPP_FIREBASE_API_KEY=api-key',
        'MINIAPP_FIREBASE_AUTH_DOMAIN=ebook-firebase.firebaseapp.com',
        'MINIAPP_FIREBASE_PROJECT_ID=ebook-firebase',
        'MINIAPP_FIREBASE_STORAGE_BUCKET=ebook-firebase.firebasestorage.app',
        'MINIAPP_FIREBASE_MESSAGING_SENDER_ID=1234567890',
        'MINIAPP_FIREBASE_APP_ID=1:1234567890:web:abc123',
        'MINIAPP_FIREBASE_MEASUREMENT_ID=G-123456',
        'MINIAPP_FIREBASE_FUNCTION_REGION=asia-northeast3',
        '',
      ].join('\n'),
    )
    assert.equal(
      backofficeEnv,
      [
        'VITE_FIREBASE_API_KEY=api-key',
        'VITE_FIREBASE_AUTH_DOMAIN=ebook-firebase.firebaseapp.com',
        'VITE_FIREBASE_PROJECT_ID=ebook-firebase',
        'VITE_FIREBASE_STORAGE_BUCKET=ebook-firebase.firebasestorage.app',
        'VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890',
        'VITE_FIREBASE_APP_ID=1:1234567890:web:abc123',
        'VITE_FIREBASE_MEASUREMENT_ID=G-123456',
        '',
      ].join('\n'),
    )
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})

test('writeFirebaseServerLocalEnvFile creates server env file and preserves credentials', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-firebase-server-'))

  try {
    await writeFirebaseServerLocalEnvFile({
      targetRoot,
      projectId: 'ebook-firebase',
      functionRegion: 'asia-northeast3',
    })

    const initialServerEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.equal(
      initialServerEnv,
      [
        '# Firebase project metadata for this workspace.',
        'FIREBASE_PROJECT_ID=ebook-firebase',
        'FIREBASE_FUNCTION_REGION=asia-northeast3',
        'FIREBASE_TOKEN=',
        'GOOGLE_APPLICATION_CREDENTIALS=',
        '',
      ].join('\n'),
    )

    await writeFile(
      path.join(targetRoot, 'server', '.env.local'),
      [
        '# Firebase project metadata for this workspace.',
        'FIREBASE_PROJECT_ID=old-project',
        'FIREBASE_FUNCTION_REGION=us-central1',
        'FIREBASE_TOKEN=firebase-token',
        'GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase.json',
        'EXTRA=value',
        '',
      ].join('\n'),
      'utf8',
    )

    await writeFirebaseServerLocalEnvFile({
      targetRoot,
      projectId: 'next-project',
      functionRegion: 'europe-west1',
    })

    const updatedServerEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.match(updatedServerEnv, /^FIREBASE_PROJECT_ID=next-project$/m)
    assert.match(updatedServerEnv, /^FIREBASE_FUNCTION_REGION=europe-west1$/m)
    assert.match(updatedServerEnv, /^FIREBASE_TOKEN=firebase-token$/m)
    assert.match(updatedServerEnv, /^GOOGLE_APPLICATION_CREDENTIALS=\/tmp\/firebase\.json$/m)
    assert.match(updatedServerEnv, /^EXTRA=value$/m)
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})

test('finalizeFirebaseProvisioning writes env files when sdk config is available', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-firebase-finalize-'))

  try {
    const notes = await finalizeFirebaseProvisioning({
      targetRoot,
      packageManager: 'npm',
      provisionedProject: {
        projectId: 'ebook-firebase',
        webAppId: '1:1234567890:web:abc123',
        functionRegion: 'asia-northeast3',
        mode: 'existing',
        config: {
          apiKey: 'api-key',
          authDomain: 'ebook-firebase.firebaseapp.com',
          projectId: 'ebook-firebase',
          storageBucket: 'ebook-firebase.firebasestorage.app',
          messagingSenderId: '1234567890',
          appId: '1:1234567890:web:abc123',
        },
      },
    })

    const frontendEnv = await readFile(path.join(targetRoot, 'frontend', '.env.local'), 'utf8')
    const serverEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.match(frontendEnv, /^MINIAPP_FIREBASE_PROJECT_ID=ebook-firebase$/m)
    assert.match(serverEnv, /^FIREBASE_PROJECT_ID=ebook-firebase$/m)
    assert.match(serverEnv, /^FIREBASE_FUNCTION_REGION=asia-northeast3$/m)
    assert.match(serverEnv, /^FIREBASE_TOKEN=$/m)
    assert.equal(notes[0]?.title, 'Firebase 연결 값을 적어뒀어요')
    assert.match(notes[0]?.body ?? '', /## Firebase deploy auth/)
    assert.match(
      notes[0]?.body ?? '',
      /server\/\.env\.local 의 `FIREBASE_TOKEN`과 `GOOGLE_APPLICATION_CREDENTIALS`는 비어 있어요/,
    )
    assert.match(notes[0]?.body ?? '', /FIREBASE_TOKEN/)
    assert.match(notes[0]?.body ?? '', /npx firebase-tools login:ci/)
    assert.match(notes[0]?.body ?? '', /server\/README\.md/)
    assert.match(notes[0]?.body ?? '', /iam-admin\/serviceaccounts\?project=ebook-firebase/)
    assert.doesNotMatch(notes[0]?.body ?? '', /Cloud Functions Developer/)
    assert.doesNotMatch(notes[0]?.body ?? '', /Service Account User/)
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})

test('finalizeFirebaseProvisioning falls back to manual setup guidance when sdk config is unavailable', async () => {
  const targetRoot = await mkdtemp(path.join(os.tmpdir(), 'create-rn-miniapp-firebase-manual-'))

  try {
    await mkdir(path.join(targetRoot, 'server'), { recursive: true })
    await writeFile(
      path.join(targetRoot, 'server', '.env.local'),
      [
        '# Firebase project metadata for this workspace.',
        'GOOGLE_APPLICATION_CREDENTIALS=/tmp/firebase.json',
        '',
      ].join('\n'),
      'utf8',
    )

    const notes = await finalizeFirebaseProvisioning({
      targetRoot,
      packageManager: 'npm',
      provisionedProject: {
        projectId: 'ebook-firebase',
        webAppId: '1:1234567890:web:abc123',
        functionRegion: 'asia-northeast3',
        mode: 'existing',
        config: null,
      },
    })

    const serverEnv = await readFile(path.join(targetRoot, 'server', '.env.local'), 'utf8')

    assert.equal(notes[0]?.title, 'Firebase 연결 값을 이렇게 넣어 주세요')
    assert.match(notes[0]?.body ?? '', /frontend\/\.env\.local/)
    assert.match(notes[0]?.body ?? '', /server\/\.env\.local/)
    assert.match(notes[0]?.body ?? '', /## Firebase deploy auth/)
    assert.doesNotMatch(notes[0]?.body ?? '', /CI나 비대화형 배포가 필요할 때만 채우면 됩니다/)
    assert.match(serverEnv, /^FIREBASE_PROJECT_ID=ebook-firebase$/m)
    assert.match(serverEnv, /^FIREBASE_TOKEN=$/m)
    assert.match(serverEnv, /^GOOGLE_APPLICATION_CREDENTIALS=\/tmp\/firebase\.json$/m)
    assert.match(notes[0]?.body ?? '', /server\/\.env\.local 의 `FIREBASE_TOKEN`은 비어 있어요/)
    assert.match(notes[0]?.body ?? '', /npx firebase-tools login:ci/)
    assert.match(notes[0]?.body ?? '', /server\/README\.md/)
    assert.doesNotMatch(notes[0]?.body ?? '', /Cloud Functions Developer/)
    assert.doesNotMatch(notes[0]?.body ?? '', /iam-admin\/serviceaccounts\?project=ebook-firebase/)
  } finally {
    await rm(targetRoot, { recursive: true, force: true })
  }
})
