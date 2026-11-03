import { deflateSync } from "node:zlib"
import { Pool } from "pg"
import { createClient } from "@supabase/supabase-js"

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** Solid-colour PNG with a lighter diagonal band so scaling and cropping are visible. */
function solidPng(width, height, [r, g, b]) {
  const row = Buffer.alloc(1 + width * 3)
  const raw = Buffer.alloc(row.length * height)
  for (let y = 0; y < height; y++) {
    const offset = y * row.length
    raw[offset] = 0
    for (let x = 0; x < width; x++) {
      const band = Math.abs(x / width - y / height) < 0.04
      const i = offset + 1 + x * 3
      raw[i] = band ? 255 : r
      raw[i + 1] = band ? 255 : g
      raw[i + 2] = band ? 255 : b
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ])
}

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
    `INSERT INTO shoots (client_name, client_email, shoot_type, status, shoot_date, location, is_comped, vault_access_code)
     VALUES ($1, $2, $3, 'delivered_settled', now(), $4, true, $5) RETURNING id`,
    ["Delivery Test", EMAIL, "Portraits", "Test Location", "PS-TEST"]
  )
  const vault = await pool.query(
    `INSERT INTO vaults (shoot_id, pin_code, status, contract_signed, deposit_paid, deposit_amount, balance_amount)
     VALUES ($1, $2, 'Active', true, true, 0, 0) RETURNING id`,
    [shoot.rows[0].id, PIN]
  )
  const vaultId = vault.rows[0].id

  // Small pixel sizes keep the test fast; the stored width/height mimic real high-res originals' proportions.
  const specs = [
    { name: "landscape.png", width: 600, height: 400, color: [59, 130, 246] },
    { name: "portrait.png", width: 400, height: 600, color: [16, 185, 129] },
    { name: "square.png", width: 480, height: 480, color: [245, 158, 11] },
  ]

  for (const spec of specs) {
    const id = crypto.randomUUID()
    const original = solidPng(spec.width, spec.height, spec.color)
    const storagePath = `vault-photos/${vaultId}/${id}.png`
    const up = await bucket.upload(storagePath, original, { contentType: "image/png" })
    if (up.error) throw new Error(up.error.message)

    await pool.query(
      `INSERT INTO vault_photos (vault_id, storage_path, thumb_path, file_name, content_type, size_bytes, width, height)
       VALUES ($1, $2, NULL, $3, 'image/png', $4, $5, $6)`,
      [vaultId, storagePath, spec.name, original.length, spec.width, spec.height]
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
