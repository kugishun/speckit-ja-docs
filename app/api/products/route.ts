import { supabaseClient } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { data, error } = await supabaseClient
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
  } catch (err) {
    console.error('[GET /api/products] error', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
