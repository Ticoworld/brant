export async function fetchLocalFixtureBootstrap() {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch('/api/v2-init-bootstrap', {cache: 'no-store'});
      if (response.status < 500 || attempt === 3) return response;
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw Error('Fixture bootstrap unavailable');
}
