/**
 * Contract tests for GET /api/products
 */

afterEach(() => {
  jest.resetModules()
})

describe('GET /api/products', () => {
  test('returns products from supabase', async () => {
    jest.doMock('@/lib/supabase', () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  { id: 'p1', product_name: 'テストプラン', amount_jpy: 1000, created_at: new Date().toISOString() },
                ],
                error: null,
              }),
          }),
        }),
      }),
    }))

    const mod = await import('../../app/api/products/route')
    const res = await mod.GET()
    const text = await res.text()
    const body = JSON.parse(text)

    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(body[0].product_name).toBe('テストプラン')
  })

  test('falls back to sample data when supabase client unavailable', async () => {
    jest.doMock('@/lib/supabase', () => ({}), { virtual: true })

    const mod = await import('../../app/api/products/route')
    const res = await mod.GET()
    const text = await res.text()
    const body = JSON.parse(text)

    expect(Array.isArray(body)).toBe(true)
    expect(body[0]).toHaveProperty('product_name')
  })
})
