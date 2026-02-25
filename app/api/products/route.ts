export async function GET() {
  try {
    const mod = await import('@/lib/supabase')
    // Prefer server admin client when available
    const client =
      typeof mod.createAdminClient === 'function'
        ? mod.createAdminClient()
        : typeof mod.getSupabaseClient === 'function'
        ? mod.getSupabaseClient(true)
        : null

    if (client) {
      const { data, error } = await client
        .from('products')
        .select('id, product_name, amount_jpy, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[GET /api/products] supabase error', error)
        return new Response(JSON.stringify({ error: 'Failed to fetch products' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify(data ?? []), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fallback sample if client unavailable
    return new Response(JSON.stringify([{ id: 'sample', product_name: 'サンプル', amount_jpy: 1000 }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[GET /api/products] handler error', err)
    return new Response(JSON.stringify([{ id: 'sample', product_name: 'サンプル', amount_jpy: 1000 }]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
