const DEAD_REGEX = /AADSTS50173|AADSTS700082|AADSTS700084|AADSTS700016|invalid_grant|interaction_required/i;

function testDeadMarkers() {
  const deadCases = [
    'AADSTS50173: The provided grant has expired due to password change.',
    'AADSTS700082: The refresh token has expired due to inactivity.',
    'AADSTS700084: The refresh token has been revoked.',
    'AADSTS700016: Application with identifier ... was not found.',
    'error: invalid_grant, description: The user account has been disabled.',
    'interaction_required: MFA or terms acceptance required.',
  ];

  for (const msg of deadCases) {
    if (!DEAD_REGEX.test(msg)) {
      console.error(`✘ Expected dead marker to match: ${msg}`);
      process.exit(1);
    }
  }

  const nonDeadCases = [
    'ETIMEDOUT: Connection timed out',
    'HTTP 500 Internal Server Error',
    'HTTP 503 Service Unavailable',
    'Rate limited by Microsoft Graph (429)',
  ];

  for (const msg of nonDeadCases) {
    if (DEAD_REGEX.test(msg)) {
      console.error(`✘ Non-dead error was mistakenly matched as dead: ${msg}`);
      process.exit(1);
    }
  }

  console.log(`✔ [PASS] All ${deadCases.length} dead marker cases and ${nonDeadCases.length} transient error cases tested correctly.`);
}

testDeadMarkers();
