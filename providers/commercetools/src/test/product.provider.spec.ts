import { CommercetoolsProductProvider } from '../providers/product.provider';

describe('Commercetools Product Provider', () => {
  it('should be able to get a product by id', async () => {
    const provider = new CommercetoolsProductProvider({
        apiUrl: process.env['COMMERCETOOLS_API_URL'] || '',
        authUrl: process.env['COMMERCETOOLS_AUTH_URL'] || '',
        clientId: process.env['COMMERCETOOLS_CLIENT_ID'] || '',
        clientSecret: process.env['COMMERCETOOLS_CLIENT_SECRET'] || '',
        projectKey: process.env['COMMERCETOOLS_PROJECT_KEY'] || ''
    });

    const result = await provider.get({ id: '4d28f98d-c446-446e-b59a-d9f718e5b98a'});

    expect(result.identifier.id).toBe('4d28f98d-c446-446e-b59a-d9f718e5b98a');
    expect(result.name).toBe('Sunnai Glass Bowl');
    expect(result.image).toBe('https://storage.googleapis.com/merchant-center-europe/sample-data/goodstore/Sunnai_Glass_Bowl-1.1.jpeg');
  });
});
