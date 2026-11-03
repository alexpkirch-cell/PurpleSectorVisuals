import { Pool } from "pg"
import sharp from "sharp"
import { createClient } from "@supabase/supabase-js"

const action = process.argv[2]
const PIN = "999111"
const EMAIL = "delivery-test@example.com"

const url = new URL(process.env.POSTGRES_URL)
url.searchParams.delete("sslmode")
const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const bucket = supabase.storage.from("gallery-photos")

async function cleanup() {
  const vaults = await pool.query(`SELECT id, shoot_id FROM vaults WHERE pin_code = $1`, [PIN])
  for (const vault of vaults.rows) {
    const photos = await pool.query(`SELECT storage_path, thumb_path FROM vault_photos WHERE vault_id = $1`, [vault.id])
    const paths = photos.rows.flatMap((p) => [p.storage_path, p.thumb_path]).filter(Boolean)
    if (paths.length) await bucket.remove(paths)
    await pool.query(`DELETE FROM vaults WHERE id = $1`, [vault.id])
    if (vault.shoot_id) await pool.query(`DELETE FROM shoots WHERE id = $1`, [vault.shoot_id])
  }
  console.log("[v0] test fixture removed")
}

async function create() {
  await cleanup()

  const shoot = await pool.query(
    `INSERT INTO shoots (client_name, client_email, shoot_type, status, shoot_date, location, is_comped)
     VALUES ($1, $2, $3, 'delivered_settled', now(), $4, true) RETURNING id`,
    ["Delivery Test", EMAIL, "Portraits", "Test Location"]
  )
  const vault = await pool.query(
    `INSERT INTO vaults (shoot_id, pin_code, status, contract_signed, deposit_paid, deposit_amount, balance_amount)
     VALUES ($1, $2, 'Active', true, true, 0, 0) RETURNING id`,
    [shoot.rows[0].id, PIN]
  )
  const vaultId = vault.rows[0].id

  const specs = [
    { name: "landscape.jpg", width: 3000, height: 2000, color: "#3b82f6" },
    { name: "portrait.jpg", width: 2000, height: 3000, color: "#10b981" },
    { name: "square.jpg", width: 2400, height: 2400, color: "#f59e0b" },
  ]

  for (const spec of specs) {
    const id = crypto.randomUUID()
    const original = await sharp({ create: { width: spec.width, height: spec.height, channels: 3, background: spec.color } })
      .jpeg({ quality: 90 })
      .toBuffer()
    const storagePath = `vault-photos/${vaultId}/${id}.jpg`
    const up = await bucket.upload(storagePath, original, { contentType: "image/jpeg" })
    if (up.error) throw new Error(up.error.message)

    const longEdge = Math.max(spec.width, spec.height)
    const scale = 1600 / longEdge
    const thumb = await sharp(original).resize(Math.round(spec.width * scale), Math.round(spec.height * scale)).jpeg({ quality: 85 }).toBuffer()
    const thumbPath = `vault-photos/${vaultId}/thumbs/${id}.jpg`
    const th = await bucket.upload(thumbPath, thumb, { contentType: "image/jpeg" })
    if (th.error) throw new Error(th.error.message)

    await pool.query(
      `INSERT INTO vault_photos (vault_id, storage_path, thumb_path, file_name, content_type, size_bytes, width, height)
       VALUES ($1, $2, $3, $4, 'image/jpeg', $5, $6, $7)`,
      [vaultId, storagePath, thumbPath, spec.name, original.length, spec.width, spec.height]
    )
  }
  console.log("[v0] test fixture ready:", { vaultId, pin: PIN, email: EMAIL })
}

try {
  if (action === "cleanup") await cleanup()
  else await create()
} catch (error) {
  console.error("[v0] fixture failed:", error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
