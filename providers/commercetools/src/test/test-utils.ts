export function getCommercetoolsTestConfiguration() {
  return {
        apiUrl: process.env['CTP_API_URL'] || '',
        authUrl: process.env['CTP_AUTH_URL'] || '',
        clientId: process.env['CTP_CLIENT_ID'] || '',
        clientSecret: process.env['CTP_CLIENT_SECRET'] || '',
        projectKey: process.env['CTP_PROJECT_KEY'] || '',
        scopes: (process.env['CTP_SCOPES'] || '').split(',').map(x => x.trim()).filter(x => x && x.length > 0),
    }
}

