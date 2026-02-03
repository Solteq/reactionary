import Layout from '@theme/Layout';

export default function Home() {
  return (
    <Layout title="Home">
      <main style={{ padding: '2rem' }}>
        <h1>Welcome to My Docs</h1>
        <p>Get started by reading the <a href="/docs/intro">introduction</a>.</p>
      </main>
    </Layout>
  );
}